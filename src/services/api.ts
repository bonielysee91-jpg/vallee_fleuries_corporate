import {
  Amenity,
  City,
  Property,
  VisitAppointment,
  Booking,
  LeaseAgreement,
  Transaction,
  QuittanceLoyer,
  MoveInCostBreakdown,
  User,
  UserRole
} from '../types/index.ts';

export function formatFcfa(amount: number, suffix = 'FCFA'): string {
  if (isNaN(amount) || amount === null || amount === undefined) return `0 ${suffix}`;
  const formatted = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} ${suffix}`;
}

const API_BASE = '/api';

/**
 * The access token lives in memory only: it is never persisted to
 * localStorage, so an XSS payload cannot lift a 1-hour bearer token from disk.
 * The long-lived refresh token is an httpOnly cookie the browser sends
 * automatically; the token below is only a secondary convenience for
 * `Authorization: Bearer` on cross-origin capable setups.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  /** Charge utile d'erreur renvoyée par l'API (ex. `phoneNumber` d'un compte non vérifié). */
  payload?: unknown;

  constructor(message: string, status: number, code?: string, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

/** Single-flight refresh so parallel 401s trigger exactly one rotation. */
let refreshInFlight: Promise<boolean> | null = null;

async function rotateRefreshToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const json = await res.json().catch(() => null);
        if (json?.token) accessToken = json.token as string;
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Internal: prevents an infinite refresh loop on the retried request. */
  retried?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, retried = false } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  // Expired access token → rotate once via the httpOnly refresh cookie, then retry.
  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    const refreshed = await rotateRefreshToken();
    if (refreshed) return request<T>(path, { ...options, retried: true });
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      (json?.error as string) || `Erreur serveur (${res.status})`,
      res.status,
      json?.code as string | undefined,
      json ?? undefined
    );
  }

  return json as T;
}

export interface AuthResult {
  user: User;
  token: string;
}

/** Retour de l'inscription self-service : le compte est créé mais non encore vérifié. */
export interface RegisterResult {
  success: boolean;
  message: string;
  requiresVerification: boolean;
  phoneNumber: string;
  /** Renvoyé uniquement hors production (aucune passerelle SMS configurée). */
  devOtpCode?: string;
}

export interface AdminUserPage {
  data: User[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  ipAddress: string | null;
  details: unknown;
  createdAt: string;
  actor: { fullName: string; email: string; role: UserRole } | null;
}

export interface AdminStats {
  users: number;
  properties: number;
  bookings: number;
  activeSessions: number;
  transactionVolumeFcfa: number;
  commissionRevenueFcfa: number;
}

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

/** Invitation administrateur émise depuis le Command Center. */
export interface AdminInvitation {
  id: string;
  email: string;
  phoneNumber: string | null;
  fullName: string | null;
  role: UserRole;
  code: string;
  status: InvitationStatus;
  invitedBy: { fullName: string; email: string } | null;
  acceptedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface SchemaField {
  name: string;
  type: string;
  isRequired: boolean;
  isList: boolean;
  isId: boolean;
  isUnique: boolean;
}

export interface SchemaModel {
  name: string;
  fieldCount: number;
  relationCount: number;
  fields: SchemaField[];
}

export interface SchemaEnum {
  name: string;
  values: string[];
}

/** Structural readout of the live Neon database (no row data, metadata only). */
export interface SystemArchitecture {
  provider: string;
  orm: string;
  neon: {
    status: string;
    host: string;
    database: string;
    region: string;
    ssl: boolean;
    driver: string;
    timestamp: string;
  };
  databaseReachable: boolean;
  counts: { models: number; enums: number; liveTables: number };
  models: SchemaModel[];
  enums: SchemaEnum[];
  liveTables: string[];
}

export const api = {
  // -----------------------------------------------------------
  // AUTHENTICATION & SESSIONS
  // -----------------------------------------------------------
  async loginWithPassword(identifier: string, password: string): Promise<AuthResult> {
    const json = await request<AuthResult & { success: boolean }>('/auth/login', {
      method: 'POST',
      body: { identifier, password }
    });
    setAccessToken(json.token);
    return { user: json.user, token: json.token };
  },

  /**
   * Inscription self-service : le compte est créé au statut « non vérifié ».
   * Aucun jeton n'est délivré tant que le code SMS n'a pas été confirmé.
   */
  async registerUser(userData: {
    fullName: string;
    phoneNumber: string;
    email?: string;
    password?: string;
    role?: UserRole;
    companyName?: string;
  }): Promise<RegisterResult> {
    return request<RegisterResult>('/auth/register', {
      method: 'POST',
      body: userData
    });
  },

  /** Valide le code reçu par SMS et active la session en cas de succès. */
  async verifyRegistration(phoneNumber: string, code: string): Promise<AuthResult> {
    const json = await request<AuthResult & { success: boolean }>('/auth/register/verify', {
      method: 'POST',
      body: { phoneNumber, code }
    });
    setAccessToken(json.token);
    return { user: json.user, token: json.token };
  },

  /** Renvoie un nouveau code si le compte n'est pas encore vérifié. */
  async resendRegistrationCode(
    phoneNumber: string
  ): Promise<{ success: boolean; message: string; devOtpCode?: string }> {
    return request('/auth/register/resend', { method: 'POST', body: { phoneNumber } });
  },

  async sendSmsOtp(phoneNumber: string): Promise<{ success: boolean; devOtpCode?: string }> {
    return request('/auth/otp/send', { method: 'POST', body: { phoneNumber } });
  },

  async verifySmsOtp(
    phoneNumber: string,
    code: string,
    fullName?: string,
    role?: UserRole
  ): Promise<AuthResult> {
    const json = await request<AuthResult & { success: boolean }>('/auth/otp/verify', {
      method: 'POST',
      body: { phoneNumber, code, fullName, role }
    });
    setAccessToken(json.token);
    return { user: json.user, token: json.token };
  },

  /**
   * Returns `null` when there is no valid session. It never fabricates a user —
   * the route guards depend on this being truthful.
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const json = await request<{ user: User }>('/auth/me');
      return json.user;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return null;
      return null;
    }
  },

  /** Exchange the httpOnly refresh cookie for a fresh session (page reload). */
  async refreshSession(): Promise<User | null> {
    try {
      const json = await request<{ user: User; token?: string }>('/auth/refresh', {
        method: 'POST'
      });
      if (json.token) setAccessToken(json.token);
      return json.user;
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
    }
  },

  // -----------------------------------------------------------
  // TENANT SPACE — FAVORITES & ACTIVE RENTALS
  // -----------------------------------------------------------
  async getFavorites(): Promise<string[]> {
    const json = await request<{ data: string[] }>('/favorites');
    return json.data;
  },

  async addFavorite(propertyId: string): Promise<void> {
    await request(`/favorites/${encodeURIComponent(propertyId)}`, { method: 'POST' });
  },

  async removeFavorite(propertyId: string): Promise<void> {
    await request(`/favorites/${encodeURIComponent(propertyId)}`, { method: 'DELETE' });
  },

  async getMyRentals(): Promise<{ leases: LeaseAgreement[]; bookings: Booking[] }> {
    const json = await request<{ data: { leases: LeaseAgreement[]; bookings: Booking[] } }>(
      '/my-rentals'
    );
    return json.data;
  },

  // -----------------------------------------------------------
  // RENTAL PROPERTIES
  // -----------------------------------------------------------
  async getProperties(params?: Record<string, any>): Promise<Property[]> {
    const query = params ? new URLSearchParams(params).toString() : '';
    const json = await request<{ data: Property[] }>(`/rentals?${query}`);
    return json.data;
  },

  async getPropertyById(id: string): Promise<Property | null> {
    const json = await request<{ data: Property }>(`/rentals/${encodeURIComponent(id)}`);
    return json.data;
  },

  /** Reference geography (4 Ivorian hubs + communes/neighbourhoods) from Neon. */
  async getGeography(): Promise<City[]> {
    const json = await request<{ data: City[] }>('/geography');
    return json.data;
  },

  async getAmenities(): Promise<Amenity[]> {
    const json = await request<{ data: Amenity[] }>('/amenities');
    return json.data;
  },

  async createProperty(propertyData: Partial<Property>): Promise<Property> {
    const json = await request<{ data: Property }>('/rentals', {
      method: 'POST',
      body: propertyData
    });
    return json.data;
  },

  async updateProperty(id: string, propertyData: Partial<Property>): Promise<Property> {
    const json = await request<{ data: Property }>(
      `/properties/${encodeURIComponent(id)}`,
      { method: 'PUT', body: propertyData }
    );
    return json.data;
  },

  async deleteProperty(id: string): Promise<void> {
    await request<{ success: boolean }>(`/properties/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },

  async updatePropertyStatus(id: string, status: Property['status']): Promise<Property> {
    const json = await request<{ data: Property }>(
      `/properties/${encodeURIComponent(id)}/status`,
      { method: 'PATCH', body: { status } }
    );
    return json.data;
  },

  // -----------------------------------------------------------
  // MOVE-IN COST CALCULATOR (2 MOIS AVANCE + 2 MOIS CAUTION)
  // -----------------------------------------------------------
  async calculateMoveInCost(
    monthlyRent: number,
    advanceMonths = 2,
    depositMonths = 2,
    agencyFeeMonths = 1,
    keyMoney = 0
  ): Promise<MoveInCostBreakdown> {
    try {
      const params = new URLSearchParams({
        monthlyRent: monthlyRent.toString(),
        advanceMonths: advanceMonths.toString(),
        depositMonths: depositMonths.toString(),
        agencyFeeMonths: agencyFeeMonths.toString(),
        keyMoney: keyMoney.toString()
      });
      const json = await request<{ data: MoveInCostBreakdown }>(
        `/calculator/move-in?${params.toString()}`
      );
      return json.data;
    } catch (err) {
      const advanceAmount = monthlyRent * advanceMonths;
      const depositAmount = monthlyRent * depositMonths;
      const agencyFeeAmount = monthlyRent * agencyFeeMonths;
      const stampDuty = Math.round(monthlyRent * 12 * 0.025);
      const total = advanceAmount + depositAmount + agencyFeeAmount + keyMoney + stampDuty;
      return {
        monthlyRent,
        monthlyRentFcfa: monthlyRent,
        advanceMonths,
        advanceAmount,
        advanceAmountFcfa: advanceAmount,
        depositMonths,
        depositAmount,
        depositAmountFcfa: depositAmount,
        agencyFeeMonths,
        agencyFeeAmount,
        agencyFeeAmountFcfa: agencyFeeAmount,
        keyMoney,
        keyMoneyFcfa: keyMoney,
        serviceCharges: 0,
        stampDutyAndRegistration: stampDuty,
        leaseDraftingFeeFcfa: stampDuty,
        totalUpfrontCost: total,
        totalInitialPayoutFcfa: total,
        legalNotice:
          'Loi N° 2019-576 du 26 juin 2019 : Plafonnement légal strict à 2 mois d\'avance et 2 mois de caution en Côte d\'Ivoire.',
        currency: 'FCFA'
      };
    }
  },

  // -----------------------------------------------------------
  // VISITS & APPOINTMENTS
  // -----------------------------------------------------------
  async scheduleVisit(visitData: Partial<VisitAppointment>): Promise<VisitAppointment> {
    const json = await request<{ data: VisitAppointment }>('/visits', {
      method: 'POST',
      body: visitData
    });
    return json.data;
  },

  async getVisits(): Promise<VisitAppointment[]> {
    const json = await request<{ data: VisitAppointment[] }>('/visits');
    return json.data;
  },

  // -----------------------------------------------------------
  // BOOKINGS (SHORT-STAY FURNISHED RESIDENCES)
  // -----------------------------------------------------------
  async createBooking(bookingData: Partial<Booking>): Promise<Booking> {
    const json = await request<{ data: Booking }>('/bookings', {
      method: 'POST',
      body: bookingData
    });
    return json.data;
  },

  async getBookings(): Promise<Booking[]> {
    const json = await request<{ data: Booking[] }>('/bookings');
    return json.data;
  },

  async getLeases(): Promise<LeaseAgreement[]> {
    const json = await request<{ data: LeaseAgreement[] }>('/leases');
    return json.data;
  },

  // -----------------------------------------------------------
  // PAYMENTS & MOBILE MONEY (WAVE, ORANGE, MTN, MOOV)
  // -----------------------------------------------------------
  /**
   * Envoie par SMS le code à valider AVANT toute exécution du débit.
   * `devOtpCode` n'est renvoyé qu'hors production (test sans passerelle SMS).
   */
  async requestPaymentCode(payload: {
    phoneNumber: string;
  }): Promise<{
    success: boolean;
    /** `false` quand aucune passerelle SMS n'est configurée : le débit se fait sans code. */
    codeRequired?: boolean;
    message: string;
    expiresAt?: string;
    devOtpCode?: string;
  }> {
    return request('/payments/confirm-code', { method: 'POST', body: payload });
  },

  async initiatePayment(payload: {
    phoneNumber: string;
    provider: string;
    amountFcfa: number;
    purpose: string;
    clientName?: string;
    propertyTitle?: string;
    /** Rattachement optionnel au contrat : activé automatiquement à l'encaissement. */
    propertyId?: string;
    bookingId?: string;
    leaseId?: string;
    /** Code de validation reçu par SMS — obligatoire : sans lui, aucun débit n'est exécuté. */
    confirmationCode: string;
  }): Promise<Transaction & { paymentUrl?: string | null }> {
    const json = await request<{ data: Transaction & { paymentUrl?: string | null } }>(
      '/payments/initiate',
      {
        method: 'POST',
        body: payload
      }
    );
    return json.data;
  },

  async getTransactions(): Promise<Transaction[]> {
    const json = await request<{ success: boolean; data: Transaction[] }>('/transactions');
    return json.data;
  },

  /**
   * Récupère le grand livre des transactions en CSV. Le fichier est protégé par jeton :
   * un simple lien ne fonctionnerait pas, il faut donc le charger puis le télécharger.
   */
  async exportPaymentsCsv(): Promise<Blob> {
    const send = () =>
      fetch(`${API_BASE}/admin/payments/export`, {
        method: 'GET',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: 'include',
      });

    let res = await send();
    if (res.status === 401 && (await rotateRefreshToken())) {
      res = await send();
    }
    if (!res.ok) {
      throw new ApiError("Export du grand livre impossible", res.status);
    }
    return res.blob();
  },

  // -----------------------------------------------------------
  // QUITTANCES DE LOYER
  // -----------------------------------------------------------
  async generateQuittance(payload: Partial<QuittanceLoyer>): Promise<QuittanceLoyer> {
    const json = await request<{ data: QuittanceLoyer }>('/quittances/generate', {
      method: 'POST',
      body: payload
    });
    return json.data;
  },

  async getQuittances(): Promise<QuittanceLoyer[]> {
    const json = await request<{ data: QuittanceLoyer[] }>('/quittances');
    return json.data;
  },

  // -----------------------------------------------------------
  // SUPER-ADMIN COMMAND CENTER (Role.ADMIN ONLY)
  // -----------------------------------------------------------
  async adminGetUsers(params?: { page?: number; pageSize?: number; q?: string }): Promise<AdminUserPage> {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<AdminUserPage>(`/admin/users?${query}`);
  },

  async adminUpdateUserRole(userId: string, role: UserRole): Promise<User> {
    const json = await request<{ data: User }>(`/admin/users/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      body: { role }
    });
    return json.data;
  },

  async adminSetUserBan(userId: string, banned: boolean, reason?: string): Promise<User> {
    const json = await request<{ data: User }>(`/admin/users/${encodeURIComponent(userId)}/ban`, {
      method: 'PATCH',
      body: { banned, reason }
    });
    return json.data;
  },

  async adminGetModerationQueue(): Promise<Property[]> {
    const json = await request<{ data: Property[] }>('/admin/moderation');
    return json.data;
  },

  async adminUpdatePropertyStatus(id: string, status: Property['status']): Promise<Property> {
    const json = await request<{ data: Property }>(
      `/admin/properties/${encodeURIComponent(id)}/status`,
      { method: 'PATCH', body: { status } }
    );
    return json.data;
  },

  async adminGetTransactions(): Promise<
    (Transaction & { commissionFcfa: number; ownerPayoutFcfa: number })[]
  > {
    const json = await request<{
      data: (Transaction & { commissionFcfa: number; ownerPayoutFcfa: number })[];
    }>('/admin/transactions');
    return json.data;
  },

  async adminGetAuditLogs(params?: { page?: number; pageSize?: number }): Promise<{
    data: AuditLogEntry[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return request(`/admin/audit-logs?${query}`);
  },

  async adminGetStats(): Promise<AdminStats> {
    const json = await request<{ data: AdminStats }>('/admin/stats');
    return json.data;
  },

  // -----------------------------------------------------------
  // INVITATIONS ADMINISTRATEUR (Command Center)
  // -----------------------------------------------------------
  async adminGetInvitations(): Promise<AdminInvitation[]> {
    const json = await request<{ data: AdminInvitation[] }>('/admin/invitations');
    return json.data;
  },

  async adminCreateInvitation(payload: {
    email: string;
    phoneNumber?: string;
    fullName?: string;
    role?: UserRole;
  }): Promise<{ invitation: AdminInvitation; mailSent: boolean; message: string }> {
    const json = await request<{ data: AdminInvitation; mailSent: boolean; message: string }>(
      '/admin/invitations',
      { method: 'POST', body: payload }
    );
    return { invitation: json.data, mailSent: json.mailSent, message: json.message };
  },

  async adminRevokeInvitation(id: string): Promise<AdminInvitation> {
    const json = await request<{ data: AdminInvitation }>(
      `/admin/invitations/${encodeURIComponent(id)}/revoke`,
      { method: 'POST' }
    );
    return json.data;
  },

  /** Endpoint public : l'invité active son compte avec le code reçu. */
  async acceptInvitation(payload: {
    code: string;
    fullName?: string;
    password?: string;
    phoneNumber?: string;
  }): Promise<AuthResult> {
    const json = await request<AuthResult & { success: boolean }>('/invitations/accept', {
      method: 'POST',
      body: payload
    });
    setAccessToken(json.token);
    return { user: json.user, token: json.token };
  },

  // -----------------------------------------------------------
  // SYSTEM ARCHITECTURE (public Neon schema readout)
  // -----------------------------------------------------------
  async getSystemArchitecture(): Promise<SystemArchitecture> {
    const json = await request<{ data: SystemArchitecture }>('/system/architecture');
    return json.data;
  }
};
