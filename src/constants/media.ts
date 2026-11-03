// Centralised catalogue of remote media assets.
//
// No binary image ships inside the client bundle: every visual is streamed from
// an external HTTPS CDN. The very same URLs are persisted in the Neon
// `PropertyImage` table, so the marketing shell and the live catalogue always
// show identical media.

const cdn = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=80`;

export const VFC_MEDIA = {
  modernVilla: cdn('photo-1600596542815-ffad4c1539a9'),
  villaPool: cdn('photo-1512917774080-9991f1c4c750'),
  luxuryInterior: cdn('photo-1600585154340-be6161a56a0c'),
  familyHouse: cdn('photo-1580587771525-78b9dba3b914'),
  duplexFacade: cdn('photo-1613490493576-7fde63acd811'),
  penthouseView: cdn('photo-1600607687939-ce8a6c25118c'),
  livingRoom: cdn('photo-1600566753086-00f18fb6b3ea'),
  furnishedApartment: cdn('photo-1560448204-e02f11c3d0e2'),
  cozyStudio: cdn('photo-1522708323590-d24dbb6b0267'),
  beachResidence: cdn('photo-1571003123894-1f0594d2b5d9'),
} as const;

/** Last-resort visual when a listing has no cover image stored in the cloud. */
export const FALLBACK_PROPERTY_IMAGE = VFC_MEDIA.modernVilla;
