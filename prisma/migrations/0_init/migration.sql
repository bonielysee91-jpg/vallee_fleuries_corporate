-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TENANT', 'OWNER', 'AGENT', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "RentalCategory" AS ENUM ('LONG_TERM_RENT', 'SHORT_TERM_FURNISHED');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'VILLA', 'STUDIO', 'DUPLEX', 'PENTHOUSE', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'UNDER_MAINTENANCE', 'PENDING_REVIEW', 'PUBLISHED', 'RENTED');

-- CreateEnum
CREATE TYPE "FurnishingStatus" AS ENUM ('UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'TERMINATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('IN_PERSON', 'VIRTUAL_3D');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('WAVE', 'ORANGE_MONEY', 'MTN_MOMO', 'MOOV_MONEY', 'CARD_CINETPAY', 'CARD_PAYSTACK', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESSFUL', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TransactionPurpose" AS ENUM ('SHORT_STAY_BOOKING', 'MOVE_IN_PACKAGE', 'MONTHLY_RENT', 'VISIT_FEE', 'SECURITY_DEPOSIT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'TENANT',
    "avatarUrl" TEXT,
    "companyName" TEXT,
    "isKycVerified" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "kycDocumentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OTPVerification" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "OTPVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "RentalCategory" NOT NULL DEFAULT 'LONG_TERM_RENT',
    "type" "PropertyType" NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "furnishing" "FurnishingStatus" NOT NULL DEFAULT 'UNFURNISHED',
    "priceFcfa" INTEGER NOT NULL,
    "depositMonths" INTEGER NOT NULL DEFAULT 2,
    "advanceMonths" INTEGER NOT NULL DEFAULT 2,
    "agencyFeeMonths" INTEGER NOT NULL DEFAULT 1,
    "keyMoneyFcfa" INTEGER NOT NULL DEFAULT 0,
    "serviceChargeFcfa" INTEGER NOT NULL DEFAULT 0,
    "cleaningFeeFcfa" INTEGER NOT NULL DEFAULT 0,
    "isNegotiable" BOOLEAN NOT NULL DEFAULT false,
    "city" TEXT NOT NULL DEFAULT 'Abidjan',
    "commune" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "surfaceM2" INTEGER NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "floorNumber" INTEGER,
    "totalFloors" INTEGER,
    "hasElevator" BOOLEAN NOT NULL DEFAULT false,
    "hasGenerator" BOOLEAN NOT NULL DEFAULT false,
    "hasWaterReserve" BOOLEAN NOT NULL DEFAULT false,
    "hasSwimmingPool" BOOLEAN NOT NULL DEFAULT false,
    "hasSecurity247" BOOLEAN NOT NULL DEFAULT true,
    "hasFiberInternet" BOOLEAN NOT NULL DEFAULT false,
    "virtualTourUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "agentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyImage" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Amenity" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "iconName" TEXT NOT NULL,

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyAmenity" (
    "propertyId" TEXT NOT NULL,
    "amenityId" TEXT NOT NULL,

    CONSTRAINT "PropertyAmenity_pkey" PRIMARY KEY ("propertyId","amenityId")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "description" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commune" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commune_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Neighborhood" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "communeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Neighborhood_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3) NOT NULL,
    "numberOfNights" INTEGER NOT NULL,
    "numberOfGuests" INTEGER NOT NULL DEFAULT 1,
    "nightlyRateFcfa" INTEGER NOT NULL,
    "totalAmountFcfa" INTEGER NOT NULL,
    "cleaningFeeFcfa" INTEGER NOT NULL DEFAULT 0,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "specialRequests" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseAgreement" (
    "id" TEXT NOT NULL,
    "leaseNumber" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "monthlyRentFcfa" INTEGER NOT NULL,
    "depositAmountFcfa" INTEGER NOT NULL,
    "advanceAmountFcfa" INTEGER NOT NULL,
    "agencyFeeFcfa" INTEGER NOT NULL,
    "keyMoneyFcfa" INTEGER NOT NULL DEFAULT 0,
    "totalMoveInFcfa" INTEGER NOT NULL,
    "status" "LeaseStatus" NOT NULL DEFAULT 'DRAFT',
    "contractPdfUrl" TEXT,
    "inventoryPdfUrl" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaseAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitAppointment" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "type" "VisitType" NOT NULL DEFAULT 'IN_PERSON',
    "status" "VisitStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "whatsappPhone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "gatewayReference" TEXT,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT,
    "bookingId" TEXT,
    "leaseId" TEXT,
    "amountFcfa" INTEGER NOT NULL,
    "feeFcfa" INTEGER NOT NULL DEFAULT 0,
    "netAmountFcfa" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "purpose" "TransactionPurpose" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "payerPhone" TEXT NOT NULL,
    "payerName" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "ipAddress" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quittance" (
    "id" TEXT NOT NULL,
    "quittanceNumber" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "tenantName" TEXT NOT NULL,
    "tenantPhone" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "propertyTitle" TEXT NOT NULL,
    "propertyAddress" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "rentAmountFcfa" INTEGER NOT NULL,
    "chargesFcfa" INTEGER NOT NULL DEFAULT 0,
    "totalPaidFcfa" INTEGER NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "transactionReference" TEXT NOT NULL,
    "qrCodeVerificationUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quittance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_phoneNumber_idx" ON "User"("phoneNumber");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "OTPVerification_phoneNumber_verified_idx" ON "OTPVerification"("phoneNumber", "verified");

-- CreateIndex
CREATE UNIQUE INDEX "Property_slug_key" ON "Property"("slug");

-- CreateIndex
CREATE INDEX "Property_category_status_idx" ON "Property"("category", "status");

-- CreateIndex
CREATE INDEX "Property_city_commune_idx" ON "Property"("city", "commune");

-- CreateIndex
CREATE INDEX "Property_priceFcfa_idx" ON "Property"("priceFcfa");

-- CreateIndex
CREATE INDEX "Property_ownerId_idx" ON "Property"("ownerId");

-- CreateIndex
CREATE INDEX "Property_latitude_longitude_idx" ON "Property"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "PropertyImage_propertyId_idx" ON "PropertyImage"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Amenity_code_key" ON "Amenity"("code");

-- CreateIndex
CREATE INDEX "PropertyAmenity_amenityId_idx" ON "PropertyAmenity"("amenityId");

-- CreateIndex
CREATE UNIQUE INDEX "City_code_key" ON "City"("code");

-- CreateIndex
CREATE UNIQUE INDEX "City_name_key" ON "City"("name");

-- CreateIndex
CREATE INDEX "City_name_idx" ON "City"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Commune_code_key" ON "Commune"("code");

-- CreateIndex
CREATE INDEX "Commune_cityId_idx" ON "Commune"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "Commune_cityId_name_key" ON "Commune"("cityId", "name");

-- CreateIndex
CREATE INDEX "Neighborhood_communeId_idx" ON "Neighborhood"("communeId");

-- CreateIndex
CREATE UNIQUE INDEX "Neighborhood_communeId_name_key" ON "Neighborhood"("communeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingNumber_key" ON "Booking"("bookingNumber");

-- CreateIndex
CREATE INDEX "Booking_propertyId_checkInDate_checkOutDate_idx" ON "Booking"("propertyId", "checkInDate", "checkOutDate");

-- CreateIndex
CREATE INDEX "Booking_tenantId_idx" ON "Booking"("tenantId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LeaseAgreement_leaseNumber_key" ON "LeaseAgreement"("leaseNumber");

-- CreateIndex
CREATE INDEX "LeaseAgreement_propertyId_idx" ON "LeaseAgreement"("propertyId");

-- CreateIndex
CREATE INDEX "LeaseAgreement_tenantId_idx" ON "LeaseAgreement"("tenantId");

-- CreateIndex
CREATE INDEX "LeaseAgreement_ownerId_idx" ON "LeaseAgreement"("ownerId");

-- CreateIndex
CREATE INDEX "LeaseAgreement_status_idx" ON "LeaseAgreement"("status");

-- CreateIndex
CREATE INDEX "VisitAppointment_propertyId_visitDate_idx" ON "VisitAppointment"("propertyId", "visitDate");

-- CreateIndex
CREATE INDEX "VisitAppointment_tenantId_idx" ON "VisitAppointment"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_reference_key" ON "Transaction"("reference");

-- CreateIndex
CREATE INDEX "Transaction_reference_idx" ON "Transaction"("reference");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_paymentMethod_idx" ON "Transaction"("paymentMethod");

-- CreateIndex
CREATE INDEX "SavedFavorite_userId_idx" ON "SavedFavorite"("userId");

-- CreateIndex
CREATE INDEX "SavedFavorite_propertyId_idx" ON "SavedFavorite"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedFavorite_userId_propertyId_key" ON "SavedFavorite"("userId", "propertyId");

-- CreateIndex
CREATE INDEX "Review_propertyId_idx" ON "Review"("propertyId");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Quittance_quittanceNumber_key" ON "Quittance"("quittanceNumber");

-- CreateIndex
CREATE INDEX "Quittance_quittanceNumber_idx" ON "Quittance"("quittanceNumber");

-- CreateIndex
CREATE INDEX "Quittance_createdAt_idx" ON "Quittance"("createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTPVerification" ADD CONSTRAINT "OTPVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyImage" ADD CONSTRAINT "PropertyImage_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAmenity" ADD CONSTRAINT "PropertyAmenity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAmenity" ADD CONSTRAINT "PropertyAmenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "Amenity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commune" ADD CONSTRAINT "Commune_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Neighborhood" ADD CONSTRAINT "Neighborhood_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseAgreement" ADD CONSTRAINT "LeaseAgreement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseAgreement" ADD CONSTRAINT "LeaseAgreement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseAgreement" ADD CONSTRAINT "LeaseAgreement_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAppointment" ADD CONSTRAINT "VisitAppointment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAppointment" ADD CONSTRAINT "VisitAppointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "LeaseAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFavorite" ADD CONSTRAINT "SavedFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFavorite" ADD CONSTRAINT "SavedFavorite_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

