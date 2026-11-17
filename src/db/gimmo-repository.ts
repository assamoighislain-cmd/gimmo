import { db } from './index.ts';
import {
  landlords,
  properties,
  tenants,
  leases,
  payments,
} from './schema.ts';
import { eq, desc } from 'drizzle-orm';

/**
 * Initialise des données de démonstration réalistes (Multi-Bailleurs, Biens géolocalisés PostGIS,
 * Locataires, Contrats de bail et Quittances/Impayés) si la base est vide.
 */
export async function ensureInitialData(userId: string = 'global_demo') {
  try {
    const existingLandlords = await db.select().from(landlords);
    if (existingLandlords.length > 0) {
      return;
    }

    // 1. Création de 3 Bailleurs (Multi-Bailleurs)
    const insertedLandlords = await db
      .insert(landlords)
      .values([
        {
          userId,
          fullName: 'Kouassi Jean-Marc',
          companyName: 'SCI Lagune Patrimoine',
          email: 'jmkouassi@lagune-patrimoine.ci',
          phone: '+2250707112233',
          address: 'Boulevard Latrille, Cocody Deux-Plateaux, Abidjan',
          taxId: 'CI-ABJ-2021-B-14920',
          iban: 'CI93 CI00 8011 1200 4928 1900 44',
          commissionRate: 8.0,
          contractHeaderNote:
            'Bail régi par les dispositions du Code Civil et de la réglementation sur les baux à usage d’habitation en République de Côte d’Ivoire. Pénalité de retard fixée à 5% après le 10 du mois.',
        },
        {
          userId,
          fullName: 'Konan Marie-Claire',
          companyName: 'Groupe Immobilier Éburnie',
          email: 'direction@eburnie-immo.ci',
          phone: '+2250505445566',
          address: 'Zone 4C, Rue du Docteur Blanchard, Marcory, Abidjan',
          taxId: 'CI-ABJ-2019-B-08312',
          iban: 'CI93 CI00 2010 9900 1837 2210 88',
          commissionRate: 10.0,
          contractHeaderNote:
            'Contrat soumis à obligation d’assurance multirisque habitation par le Preneur dès la remise des clés. Entretien de la climatisation à la charge du Locataire.',
        },
        {
          userId,
          fullName: 'Bamba Souleymane',
          companyName: 'S.B. Investissements Fonciers',
          email: 'sbamba@sbinvest.ci',
          phone: '+2250102334455',
          address: 'Avenue Chardy, Le Plateau, Abidjan',
          taxId: 'CI-ABJ-2023-A-55109',
          iban: 'CI93 CI04 5010 0039 4817 2000 11',
          commissionRate: 7.5,
          contractHeaderNote:
            'Bail commercial et professionnel avec révision triennale encadrée. Quittance émise exclusivement après encaissement effectif.',
        },
      ])
      .returning();

    const [landlord1, landlord2, landlord3] = insertedLandlords;

    // 2. Création des Biens Immobiliers Géolocalisés (PostGIS WKT + GPS)
    const insertedProperties = await db
      .insert(properties)
      .values([
        {
          userId,
          landlordId: landlord1.id,
          reference: 'GIM-COC-001',
          title: 'Résidence Les Orchidées - Appt A4',
          propertyType: 'Appartement',
          address: 'Rue des Jardins, Vallon',
          city: 'Abidjan',
          neighborhood: 'Cocody Deux-Plateaux',
          surfaceArea: 145,
          roomsCount: 4,
          monthlyRent: '650000',
          chargesAmount: '45000',
          currency: 'FCFA',
          latitude: 5.359952,
          longitude: -3.987612,
          postgisWkt: 'SRID=4326;POINT(-3.987612 5.359952)',
          status: 'occupied',
        },
        {
          userId,
          landlordId: landlord1.id,
          reference: 'GIM-RIV-002',
          title: 'Villa Duplex Riviera Golf 4',
          propertyType: 'Villa',
          address: 'Boulevard de France, Beverly Hills',
          city: 'Abidjan',
          neighborhood: 'Cocody Riviera Golf',
          surfaceArea: 320,
          roomsCount: 6,
          monthlyRent: '1400000',
          chargesAmount: '80000',
          currency: 'FCFA',
          latitude: 5.341289,
          longitude: -3.96341,
          postgisWkt: 'SRID=4326;POINT(-3.963410 5.341289)',
          status: 'occupied',
        },
        {
          userId,
          landlordId: landlord2.id,
          reference: 'GIM-Z4C-003',
          title: 'Loft Panoramique Le Calao',
          propertyType: 'Appartement',
          address: 'Rue Pierre et Marie Curie, Zone 4C',
          city: 'Abidjan',
          neighborhood: 'Marcory Zone 4',
          surfaceArea: 118,
          roomsCount: 3,
          monthlyRent: '550000',
          chargesAmount: '35000',
          currency: 'FCFA',
          latitude: 5.291845,
          longitude: -3.979104,
          postgisWkt: 'SRID=4326;POINT(-3.979104 5.291845)',
          status: 'occupied',
        },
        {
          userId,
          landlordId: landlord2.id,
          reference: 'GIM-BIA-004',
          title: 'Showroom Commercial Biétry',
          propertyType: 'Local Commercial',
          address: 'Boulevard de Marseille, Biétry',
          city: 'Abidjan',
          neighborhood: 'Marcory Biétry',
          surfaceArea: 210,
          roomsCount: 5,
          monthlyRent: '950000',
          chargesAmount: '50000',
          currency: 'FCFA',
          latitude: 5.280412,
          longitude: -3.98952,
          postgisWkt: 'SRID=4326;POINT(-3.989520 5.280412)',
          status: 'occupied',
        },
        {
          userId,
          landlordId: landlord3.id,
          reference: 'GIM-PLT-005',
          title: 'Plateau Tour Harmonie - 8e Étage',
          propertyType: 'Bureau',
          address: 'Avenue Abdoulaye Fadiga, Le Plateau',
          city: 'Abidjan',
          neighborhood: 'Plateau Centre',
          surfaceArea: 185,
          roomsCount: 6,
          monthlyRent: '1150000',
          chargesAmount: '75000',
          currency: 'FCFA',
          latitude: 5.323815,
          longitude: -4.019842,
          postgisWkt: 'SRID=4326;POINT(-4.019842 5.323815)',
          status: 'occupied',
        },
        {
          userId,
          landlordId: landlord3.id,
          reference: 'GIM-ANG-006',
          title: 'Résidence Émeraude - Studio Haut Standing',
          propertyType: 'Studio',
          address: '8e Tranche, Carrefour Prière',
          city: 'Abidjan',
          neighborhood: 'Cocody Angré',
          surfaceArea: 52,
          roomsCount: 2,
          monthlyRent: '260000',
          chargesAmount: '20000',
          currency: 'FCFA',
          latitude: 5.39412,
          longitude: -3.97845,
          postgisWkt: 'SRID=4326;POINT(-3.978450 5.394120)',
          status: 'vacant',
        },
      ])
      .returning();

    // 3. Création des Locataires
    const insertedTenants = await db
      .insert(tenants)
      .values([
        {
          userId,
          firstName: 'Awa',
          lastName: 'Touré',
          email: 'awa.toure@corp-finance.ci',
          phoneWhatsapp: '+2250708123456',
          nationalIdNumber: 'CI0049281742',
          profession: 'Directrice Financière',
          employer: 'Banque Atlantique CI',
          monthlyIncome: '2400000',
          guarantorName: 'Touré Ibrahim',
          guarantorPhone: '+2250707998877',
          dossierStatus: 'approved',
        },
        {
          userId,
          firstName: 'Stéphane',
          lastName: 'Aka',
          email: 's.aka@logistique-port.ci',
          phoneWhatsapp: '+2250504654321',
          nationalIdNumber: 'CI0083910421',
          profession: 'Ingénieur Logistique',
          employer: 'Bolloré Africa Logistics',
          monthlyIncome: '4200000',
          guarantorName: 'Aka Henriette',
          guarantorPhone: '+2250505112200',
          dossierStatus: 'approved',
        },
        {
          userId,
          firstName: 'Cédric',
          lastName: 'N’Guessan',
          email: 'c.nguessan@studio-architecture.ci',
          phoneWhatsapp: '+2250749302190',
          nationalIdNumber: 'CI0019283746',
          profession: 'Architecte DPLG',
          employer: 'Cabinet N’Guessan & Associés',
          monthlyIncome: '1950000',
          guarantorName: 'N’Guessan Paul',
          guarantorPhone: '+2250101887766',
          dossierStatus: 'approved',
        },
        {
          userId,
          firstName: 'Fatou',
          lastName: 'Diallo',
          email: 'f.diallo@maison-deco.ci',
          phoneWhatsapp: '+2250758102938',
          nationalIdNumber: 'CI0065748392',
          profession: 'Gérante de Société',
          employer: 'Maison Déco SARL',
          monthlyIncome: '3100000',
          guarantorName: 'Diallo Amadou',
          guarantorPhone: '+2250709443322',
          dossierStatus: 'approved',
        },
        {
          userId,
          firstName: 'Olivier',
          lastName: 'Koffi',
          email: 'o.koffi@tech-afrique.io',
          phoneWhatsapp: '+2250103948576',
          nationalIdNumber: 'CI0091827364',
          profession: 'Directeur Général',
          employer: 'Tech Afrique Solutions',
          monthlyIncome: '3800000',
          guarantorName: 'Koffi Michel',
          guarantorPhone: '+2250708556677',
          dossierStatus: 'approved',
        },
      ])
      .returning();

    // 4. Création des Contrats de Bail
    const insertedLeases = await db
      .insert(leases)
      .values([
        {
          userId,
          contractNumber: 'BAIL-2026-0101',
          landlordId: landlord1.id,
          propertyId: insertedProperties[0].id,
          tenantId: insertedTenants[0].id,
          startDate: '2026-01-01',
          endDate: '2027-12-31',
          rentAmount: '650000',
          chargesAmount: '45000',
          securityDeposit: '1300000',
          paymentDueDay: 5,
          customClauses:
            'Accès piscine et parking souterrain (2 places) inclus dans les charges locatives.',
          status: 'active',
          shareToken: 'tok-lease-2026-0101-a9f8',
        },
        {
          userId,
          contractNumber: 'BAIL-2026-0102',
          landlordId: landlord1.id,
          propertyId: insertedProperties[1].id,
          tenantId: insertedTenants[1].id,
          startDate: '2026-02-01',
          endDate: '2028-01-31',
          rentAmount: '1400000',
          chargesAmount: '80000',
          securityDeposit: '2800000',
          paymentDueDay: 5,
          customClauses:
            'Entretien du jardin privatif et du groupe électrogène assuré par le syndic.',
          status: 'active',
          shareToken: 'tok-lease-2026-0102-b7c4',
        },
        {
          userId,
          contractNumber: 'BAIL-2026-0103',
          landlordId: landlord2.id,
          propertyId: insertedProperties[2].id,
          tenantId: insertedTenants[2].id,
          startDate: '2026-03-01',
          endDate: '2027-02-28',
          rentAmount: '550000',
          chargesAmount: '35000',
          securityDeposit: '1100000',
          paymentDueDay: 5,
          customClauses:
            'Usage mixte habitation et bureau d’architecte autorisé sans accueil de public massif.',
          status: 'active',
          shareToken: 'tok-lease-2026-0103-c3d2',
        },
        {
          userId,
          contractNumber: 'BAIL-2026-0104',
          landlordId: landlord2.id,
          propertyId: insertedProperties[3].id,
          tenantId: insertedTenants[3].id,
          startDate: '2026-01-15',
          endDate: '2029-01-14',
          rentAmount: '950000',
          chargesAmount: '50000',
          securityDeposit: '1900000',
          paymentDueDay: 5,
          customClauses:
            'Bail commercial avec autorisation d’enseigne lumineuse en façade sur le Boulevard de Marseille.',
          status: 'active',
          shareToken: 'tok-lease-2026-0104-d5e1',
        },
        {
          userId,
          contractNumber: 'BAIL-2026-0105',
          landlordId: landlord3.id,
          propertyId: insertedProperties[4].id,
          tenantId: insertedTenants[4].id,
          startDate: '2026-04-01',
          endDate: '2029-03-31',
          rentAmount: '1150000',
          chargesAmount: '75000',
          securityDeposit: '2300000',
          paymentDueDay: 5,
          customClauses:
            'Fibre optique dédiée et sécurité 24h/24 incluses dans les charges d’immeuble.',
          status: 'active',
          shareToken: 'tok-lease-2026-0105-e8f9',
        },
      ])
      .returning();

    // 5. Création des Paiements & Quittances (Payés + Impayés / Retards pour le recouvrement)
    await db.insert(payments).values([
      {
        userId,
        receiptNumber: 'QUIT-202611-001',
        leaseId: insertedLeases[0].id,
        landlordId: landlord1.id,
        propertyId: insertedProperties[0].id,
        tenantId: insertedTenants[0].id,
        periodMonth: '2026-11',
        periodLabel: 'Novembre 2026',
        amountDue: '695000',
        amountPaid: '695000',
        dueDate: '2026-11-05',
        paymentDate: '2026-11-03',
        paymentMethod: 'Virement',
        status: 'paid',
        daysLate: 0,
        whatsappSent: true,
        shareToken: 'tok-quit-202611-001-x91a',
      },
      {
        userId,
        receiptNumber: 'QUIT-202611-002',
        leaseId: insertedLeases[1].id,
        landlordId: landlord1.id,
        propertyId: insertedProperties[1].id,
        tenantId: insertedTenants[1].id,
        periodMonth: '2026-11',
        periodLabel: 'Novembre 2026',
        amountDue: '1480000',
        amountPaid: '0',
        dueDate: '2026-11-05',
        paymentDate: null,
        paymentMethod: null,
        status: 'overdue',
        daysLate: 14,
        whatsappSent: false,
        shareToken: 'tok-quit-202611-002-y82b',
      },
      {
        userId,
        receiptNumber: 'QUIT-202611-003',
        leaseId: insertedLeases[2].id,
        landlordId: landlord2.id,
        propertyId: insertedProperties[2].id,
        tenantId: insertedTenants[2].id,
        periodMonth: '2026-11',
        periodLabel: 'Novembre 2026',
        amountDue: '585000',
        amountPaid: '585000',
        dueDate: '2026-11-05',
        paymentDate: '2026-11-04',
        paymentMethod: 'Mobile Money',
        status: 'paid',
        daysLate: 0,
        whatsappSent: true,
        shareToken: 'tok-quit-202611-003-z73c',
      },
      {
        userId,
        receiptNumber: 'QUIT-202611-004',
        leaseId: insertedLeases[3].id,
        landlordId: landlord2.id,
        propertyId: insertedProperties[3].id,
        tenantId: insertedTenants[3].id,
        periodMonth: '2026-11',
        periodLabel: 'Novembre 2026',
        amountDue: '1000000',
        amountPaid: '400000',
        dueDate: '2026-11-05',
        paymentDate: '2026-11-06',
        paymentMethod: 'Chèque',
        status: 'overdue',
        daysLate: 9,
        whatsappSent: false,
        shareToken: 'tok-quit-202611-004-w64d',
      },
      {
        userId,
        receiptNumber: 'QUIT-202611-005',
        leaseId: insertedLeases[4].id,
        landlordId: landlord3.id,
        propertyId: insertedProperties[4].id,
        tenantId: insertedTenants[4].id,
        periodMonth: '2026-11',
        periodLabel: 'Novembre 2026',
        amountDue: '1225000',
        amountPaid: '1225000',
        dueDate: '2026-11-05',
        paymentDate: '2026-11-09',
        paymentMethod: 'Virement',
        status: 'paid',
        daysLate: 0,
        whatsappSent: false,
        shareToken: 'tok-quit-202611-005-v55e',
      },
      // Historique Octobre 2026 pour rapports mensuels/annuels
      {
        userId,
        receiptNumber: 'QUIT-202610-001',
        leaseId: insertedLeases[0].id,
        landlordId: landlord1.id,
        propertyId: insertedProperties[0].id,
        tenantId: insertedTenants[0].id,
        periodMonth: '2026-10',
        periodLabel: 'Octobre 2026',
        amountDue: '695000',
        amountPaid: '695000',
        dueDate: '2026-10-05',
        paymentDate: '2026-10-04',
        paymentMethod: 'Virement',
        status: 'paid',
        daysLate: 0,
        whatsappSent: true,
        shareToken: 'tok-quit-202610-001-u44f',
      },
      {
        userId,
        receiptNumber: 'QUIT-202610-002',
        leaseId: insertedLeases[1].id,
        landlordId: landlord1.id,
        propertyId: insertedProperties[1].id,
        tenantId: insertedTenants[1].id,
        periodMonth: '2026-10',
        periodLabel: 'Octobre 2026',
        amountDue: '1480000',
        amountPaid: '1480000',
        dueDate: '2026-10-05',
        paymentDate: '2026-10-05',
        paymentMethod: 'Virement',
        status: 'paid',
        daysLate: 0,
        whatsappSent: true,
        shareToken: 'tok-quit-202610-002-t33g',
      },
    ]);
  } catch (error) {
    console.error('Database query failed in ensureInitialData:', error);
    throw new Error('Impossible d’initialiser les données de démonstration.', { cause: error });
  }
}

export async function getAllDashboardData() {
  try {
    await ensureInitialData();

    const [allLandlords, allProperties, allTenants, allLeases, allPayments] =
      await Promise.all([
        db.select().from(landlords).orderBy(desc(landlords.id)),
        db.select().from(properties).orderBy(desc(properties.id)),
        db.select().from(tenants).orderBy(desc(tenants.id)),
        db.select().from(leases).orderBy(desc(leases.id)),
        db.select().from(payments).orderBy(desc(payments.id)),
      ]);

    return {
      landlords: allLandlords,
      properties: allProperties,
      tenants: allTenants,
      leases: allLeases,
      payments: allPayments,
    };
  } catch (error) {
    console.error('Database query failed in getAllDashboardData:', error);
    throw new Error('Failed to fetch Gimmo data from PostgreSQL.', { cause: error });
  }
}

export async function getPaymentFullDetailsByToken(shareToken: string) {
  try {
    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.shareToken, shareToken));

    if (!paymentRows.length) return null;
    const payment = paymentRows[0];

    const [landlordRows, propertyRows, tenantRows, leaseRows] = await Promise.all([
      db.select().from(landlords).where(eq(landlords.id, payment.landlordId)),
      db.select().from(properties).where(eq(properties.id, payment.propertyId)),
      db.select().from(tenants).where(eq(tenants.id, payment.tenantId)),
      db.select().from(leases).where(eq(leases.id, payment.leaseId)),
    ]);

    return {
      payment,
      landlord: landlordRows[0],
      property: propertyRows[0],
      tenant: tenantRows[0],
      lease: leaseRows[0],
    };
  } catch (error) {
    console.error('Database query failed in getPaymentFullDetailsByToken:', error);
    throw new Error('Failed to load receipt details.', { cause: error });
  }
}

export async function getPaymentFullDetailsById(paymentId: number) {
  try {
    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId));

    if (!paymentRows.length) return null;
    const payment = paymentRows[0];

    const [landlordRows, propertyRows, tenantRows, leaseRows] = await Promise.all([
      db.select().from(landlords).where(eq(landlords.id, payment.landlordId)),
      db.select().from(properties).where(eq(properties.id, payment.propertyId)),
      db.select().from(tenants).where(eq(tenants.id, payment.tenantId)),
      db.select().from(leases).where(eq(leases.id, payment.leaseId)),
    ]);

    return {
      payment,
      landlord: landlordRows[0],
      property: propertyRows[0],
      tenant: tenantRows[0],
      lease: leaseRows[0],
    };
  } catch (error) {
    console.error('Database query failed in getPaymentFullDetailsById:', error);
    throw new Error('Failed to load payment details.', { cause: error });
  }
}

export async function getLeaseFullDetailsByToken(shareToken: string) {
  try {
    const leaseRows = await db
      .select()
      .from(leases)
      .where(eq(leases.shareToken, shareToken));

    if (!leaseRows.length) return null;
    const lease = leaseRows[0];

    const [landlordRows, propertyRows, tenantRows] = await Promise.all([
      db.select().from(landlords).where(eq(landlords.id, lease.landlordId)),
      db.select().from(properties).where(eq(properties.id, lease.propertyId)),
      db.select().from(tenants).where(eq(tenants.id, lease.tenantId)),
    ]);

    return {
      lease,
      landlord: landlordRows[0],
      property: propertyRows[0],
      tenant: tenantRows[0],
    };
  } catch (error) {
    console.error('Database query failed in getLeaseFullDetailsByToken:', error);
    throw new Error('Failed to load lease contract details.', { cause: error });
  }
}

export async function getLeaseFullDetailsById(leaseId: number) {
  try {
    const leaseRows = await db
      .select()
      .from(leases)
      .where(eq(leases.id, leaseId));

    if (!leaseRows.length) return null;
    const lease = leaseRows[0];

    const [landlordRows, propertyRows, tenantRows] = await Promise.all([
      db.select().from(landlords).where(eq(landlords.id, lease.landlordId)),
      db.select().from(properties).where(eq(properties.id, lease.propertyId)),
      db.select().from(tenants).where(eq(tenants.id, lease.tenantId)),
    ]);

    return {
      lease,
      landlord: landlordRows[0],
      property: propertyRows[0],
      tenant: tenantRows[0],
    };
  } catch (error) {
    console.error('Database query failed in getLeaseFullDetailsById:', error);
    throw new Error('Failed to load lease details.', { cause: error });
  }
}

export async function markPaymentAsPaid(
  paymentId: number,
  paymentMethod: string = 'Mobile Money'
) {
  try {
    const existing = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId));

    if (!existing.length) {
      throw new Error('Payment record not found');
    }

    const today = new Date().toISOString().split('T')[0];
    const updated = await db
      .update(payments)
      .set({
        amountPaid: existing[0].amountDue,
        paymentDate: today,
        paymentMethod,
        status: 'paid',
        daysLate: 0,
      })
      .where(eq(payments.id, paymentId))
      .returning();

    return updated[0];
  } catch (error) {
    console.error('Database query failed in markPaymentAsPaid:', error);
    throw new Error('Failed to record payment.', { cause: error });
  }
}

export async function markWhatsappSent(paymentId: number) {
  try {
    const updated = await db
      .update(payments)
      .set({ whatsappSent: true })
      .where(eq(payments.id, paymentId))
      .returning();
    return updated[0];
  } catch (error) {
    console.error('Database query failed in markWhatsappSent:', error);
    throw new Error('Failed to update WhatsApp status.', { cause: error });
  }
}

export async function createPropertyRecord(data: {
  userId: string;
  landlordId: number;
  reference: string;
  title: string;
  propertyType: string;
  address: string;
  city: string;
  neighborhood: string;
  surfaceArea: number;
  roomsCount: number;
  monthlyRent: string;
  chargesAmount: string;
  latitude: number;
  longitude: number;
  status: string;
}) {
  try {
    const postgisWkt = `SRID=4326;POINT(${data.longitude} ${data.latitude})`;
    const inserted = await db
      .insert(properties)
      .values({
        ...data,
        currency: 'FCFA',
        postgisWkt,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createPropertyRecord:', error);
    throw new Error('Failed to create property.', { cause: error });
  }
}

export async function createLandlordRecord(data: {
  userId: string;
  fullName: string;
  companyName?: string;
  email: string;
  phone: string;
  address: string;
  taxId?: string;
  iban?: string;
  commissionRate: number;
  contractHeaderNote?: string;
}) {
  try {
    const inserted = await db.insert(landlords).values(data).returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createLandlordRecord:', error);
    throw new Error('Failed to create landlord.', { cause: error });
  }
}

export async function createTenantAndLeaseRecord(data: {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneWhatsapp: string;
  nationalIdNumber: string;
  profession?: string;
  monthlyIncome?: string;
  propertyId: number;
  startDate: string;
  endDate: string;
  customClauses?: string;
}) {
  try {
    const propRows = await db
      .select()
      .from(properties)
      .where(eq(properties.id, data.propertyId));
    if (!propRows.length) throw new Error('Bien introuvable');
    const property = propRows[0];

    const insertedTenant = await db
      .insert(tenants)
      .values({
        userId: data.userId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneWhatsapp: data.phoneWhatsapp,
        nationalIdNumber: data.nationalIdNumber,
        profession: data.profession || 'Cadre',
        monthlyIncome: data.monthlyIncome || '1500000',
        dossierStatus: 'approved',
      })
      .returning();

    const tenant = insertedTenant[0];
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const contractNumber = `BAIL-2026-${randSuffix}`;
    const shareToken = `tok-lease-${Date.now()}-${randSuffix}`;

    const rentNum = Number(property.monthlyRent);
    const chargesNum = Number(property.chargesAmount);
    const totalDue = String(rentNum + chargesNum);

    const insertedLease = await db
      .insert(leases)
      .values({
        userId: data.userId,
        contractNumber,
        landlordId: property.landlordId,
        propertyId: property.id,
        tenantId: tenant.id,
        startDate: data.startDate,
        endDate: data.endDate,
        rentAmount: property.monthlyRent,
        chargesAmount: property.chargesAmount,
        securityDeposit: String(rentNum * 2),
        paymentDueDay: 5,
        customClauses:
          data.customClauses ||
          'Le preneur s’engage à régler le loyer au plus tard le 5 de chaque mois.',
        status: 'active',
        shareToken,
      })
      .returning();

    const lease = insertedLease[0];

    await db
      .update(properties)
      .set({ status: 'occupied' })
      .where(eq(properties.id, property.id));

    await db.insert(payments).values({
      userId: data.userId,
      receiptNumber: `QUIT-202611-${randSuffix}`,
      leaseId: lease.id,
      landlordId: property.landlordId,
      propertyId: property.id,
      tenantId: tenant.id,
      periodMonth: '2026-11',
      periodLabel: 'Novembre 2026',
      amountDue: totalDue,
      amountPaid: totalDue,
      dueDate: '2026-11-05',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'Mobile Money',
      status: 'paid',
      daysLate: 0,
      whatsappSent: false,
      shareToken: `tok-quit-${Date.now()}-${randSuffix}`,
    });

    return { tenant, lease };
  } catch (error) {
    console.error('Database query failed in createTenantAndLeaseRecord:', error);
    throw new Error('Failed to create tenant and lease.', { cause: error });
  }
}

export async function updatePropertyRecord(
  propertyId: number,
  data: {
    landlordId: number;
    reference: string;
    title: string;
    propertyType: string;
    address: string;
    city: string;
    neighborhood: string;
    surfaceArea: number;
    roomsCount: number;
    monthlyRent: string;
    chargesAmount: string;
    latitude: number;
    longitude: number;
    status: string;
  }
) {
  try {
    const postgisWkt = `SRID=4326;POINT(${data.longitude} ${data.latitude})`;
    const updated = await db
      .update(properties)
      .set({
        landlordId: data.landlordId,
        reference: data.reference,
        title: data.title,
        propertyType: data.propertyType,
        address: data.address,
        city: data.city,
        neighborhood: data.neighborhood,
        surfaceArea: data.surfaceArea,
        roomsCount: data.roomsCount,
        monthlyRent: data.monthlyRent,
        chargesAmount: data.chargesAmount,
        latitude: data.latitude,
        longitude: data.longitude,
        postgisWkt,
        status: data.status,
      })
      .where(eq(properties.id, propertyId))
      .returning();

    if (!updated.length) {
      throw new Error('Bien immobilier introuvable');
    }
    return updated[0];
  } catch (error) {
    console.error('Database query failed in updatePropertyRecord:', error);
    throw new Error('Impossible de modifier le bien immobilier.', { cause: error });
  }
}

export async function updateLandlordRecord(
  landlordId: number,
  data: {
    fullName: string;
    companyName?: string;
    email: string;
    phone: string;
    address: string;
    taxId?: string;
    iban?: string;
    commissionRate: number;
    contractHeaderNote?: string;
  }
) {
  try {
    const updated = await db
      .update(landlords)
      .set({
        fullName: data.fullName,
        companyName: data.companyName || null,
        email: data.email,
        phone: data.phone,
        address: data.address,
        taxId: data.taxId || null,
        iban: data.iban || null,
        commissionRate: data.commissionRate,
        contractHeaderNote: data.contractHeaderNote || null,
      })
      .where(eq(landlords.id, landlordId))
      .returning();

    if (!updated.length) {
      throw new Error('Bailleur introuvable');
    }
    return updated[0];
  } catch (error) {
    console.error('Database query failed in updateLandlordRecord:', error);
    throw new Error('Impossible de modifier le bailleur.', { cause: error });
  }
}

export async function updateTenantAndLeaseRecord(
  leaseId: number,
  data: {
    firstName: string;
    lastName: string;
    email: string;
    phoneWhatsapp: string;
    nationalIdNumber: string;
    profession?: string;
    employer?: string;
    guarantorName?: string;
    guarantorPhone?: string;
    propertyId: number;
    startDate: string;
    endDate: string;
    rentAmount: string;
    chargesAmount: string;
    securityDeposit: string;
    paymentDueDay: number;
    customClauses?: string;
    status: string;
  }
) {
  try {
    const leaseRows = await db
      .select()
      .from(leases)
      .where(eq(leases.id, leaseId));
    if (!leaseRows.length) throw new Error('Contrat de bail introuvable');
    const currentLease = leaseRows[0];

    const propRows = await db
      .select()
      .from(properties)
      .where(eq(properties.id, data.propertyId));
    if (!propRows.length) throw new Error('Bien immobilier introuvable');
    const property = propRows[0];

    const updatedTenant = await db
      .update(tenants)
      .set({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneWhatsapp: data.phoneWhatsapp,
        nationalIdNumber: data.nationalIdNumber,
        profession: data.profession || null,
        employer: data.employer || null,
        guarantorName: data.guarantorName || null,
        guarantorPhone: data.guarantorPhone || null,
      })
      .where(eq(tenants.id, currentLease.tenantId))
      .returning();

    const updatedLease = await db
      .update(leases)
      .set({
        landlordId: property.landlordId,
        propertyId: property.id,
        startDate: data.startDate,
        endDate: data.endDate,
        rentAmount: data.rentAmount,
        chargesAmount: data.chargesAmount,
        securityDeposit: data.securityDeposit,
        paymentDueDay: data.paymentDueDay,
        customClauses: data.customClauses || null,
        status: data.status,
      })
      .where(eq(leases.id, leaseId))
      .returning();

    return { tenant: updatedTenant[0], lease: updatedLease[0] };
  } catch (error) {
    console.error('Database query failed in updateTenantAndLeaseRecord:', error);
    throw new Error('Impossible de modifier le dossier locataire et bail.', {
      cause: error,
    });
  }
}

export async function updatePaymentRecord(
  paymentId: number,
  data: {
    periodLabel: string;
    amountDue: string;
    amountPaid: string;
    dueDate: string;
    paymentDate: string | null;
    paymentMethod: string | null;
    status: string;
    daysLate: number;
  }
) {
  try {
    const updated = await db
      .update(payments)
      .set({
        periodLabel: data.periodLabel,
        amountDue: data.amountDue,
        amountPaid: data.amountPaid,
        dueDate: data.dueDate,
        paymentDate: data.paymentDate || null,
        paymentMethod: data.paymentMethod || null,
        status: data.status,
        daysLate: data.daysLate,
      })
      .where(eq(payments.id, paymentId))
      .returning();

    if (!updated.length) {
      throw new Error('Quittance introuvable');
    }
    return updated[0];
  } catch (error) {
    console.error('Database query failed in updatePaymentRecord:', error);
    throw new Error('Impossible de modifier la quittance.', { cause: error });
  }
}

export async function createPaymentRecord(data: {
  userId: string;
  leaseId: number;
  periodMonth: string;
  periodLabel: string;
  amountDue: string;
  amountPaid: string;
  dueDate: string;
  paymentDate: string | null;
  paymentMethod: string | null;
  status: string;
  daysLate: number;
}) {
  try {
    const leaseRows = await db
      .select()
      .from(leases)
      .where(eq(leases.id, data.leaseId));

    if (!leaseRows.length) {
      throw new Error('Contrat de bail introuvable pour cette quittance');
    }
    const lease = leaseRows[0];

    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const cleanPeriod = (data.periodMonth || '2026-11').replace('-', '');
    const receiptNumber = `QUIT-${cleanPeriod}-${randSuffix}`;
    const shareToken = `tok-quit-${Date.now()}-${randSuffix}`;

    const inserted = await db
      .insert(payments)
      .values({
        userId: data.userId,
        receiptNumber,
        leaseId: lease.id,
        landlordId: lease.landlordId,
        propertyId: lease.propertyId,
        tenantId: lease.tenantId,
        periodMonth: data.periodMonth || '2026-11',
        periodLabel: data.periodLabel,
        amountDue: data.amountDue,
        amountPaid: data.amountPaid,
        dueDate: data.dueDate,
        paymentDate: data.paymentDate || null,
        paymentMethod: data.paymentMethod || null,
        status: data.status,
        daysLate: data.daysLate || 0,
        whatsappSent: false,
        shareToken,
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createPaymentRecord:', error);
    throw new Error('Impossible de créer la quittance.', { cause: error });
  }
}

export async function generateRentCallsForMonthRecord(data: {
  userId: string;
  periodMonth: string;
  periodLabel: string;
  defaultDueDay: number;
  initialStatus?: 'pending' | 'paid' | 'overdue';
}) {
  try {
    const [allLeases, existingPayments] = await Promise.all([
      db.select().from(leases),
      db
        .select()
        .from(payments)
        .where(eq(payments.periodMonth, data.periodMonth)),
    ]);

    const activeLeases = allLeases.filter((l) => l.status === 'active');
    const existingLeaseIds = new Set(existingPayments.map((p) => p.leaseId));
    const missingLeases = activeLeases.filter(
      (l) => !existingLeaseIds.has(l.id)
    );

    if (missingLeases.length === 0) {
      return [];
    }

    const cleanPeriod = (data.periodMonth || '2026-12').replace('-', '');
    const dayStr = String(data.defaultDueDay || 5).padStart(2, '0');
    const dueDate = `${data.periodMonth}-${dayStr}`;
    const status = data.initialStatus || 'pending';
    const todayStr = new Date().toISOString().split('T')[0];

    const valuesToInsert = missingLeases.map((lease, idx) => {
      const randSuffix = Math.floor(1000 + Math.random() * 9000) + idx;
      const totalDue = String(
        Number(lease.rentAmount || 0) + Number(lease.chargesAmount || 0)
      );
      return {
        userId: data.userId,
        receiptNumber: `QUIT-${cleanPeriod}-${randSuffix}`,
        leaseId: lease.id,
        landlordId: lease.landlordId,
        propertyId: lease.propertyId,
        tenantId: lease.tenantId,
        periodMonth: data.periodMonth,
        periodLabel: data.periodLabel,
        amountDue: totalDue,
        amountPaid: status === 'paid' ? totalDue : '0',
        dueDate,
        paymentDate: status === 'paid' ? todayStr : null,
        paymentMethod: status === 'paid' ? 'Mobile Money' : null,
        status,
        daysLate: 0,
        whatsappSent: false,
        shareToken: `tok-quit-${Date.now()}-${randSuffix}`,
      };
    });

    const inserted = await db
      .insert(payments)
      .values(valuesToInsert)
      .returning();
    return inserted;
  } catch (error) {
    console.error(
      'Database query failed in generateRentCallsForMonthRecord:',
      error
    );
    throw new Error('Impossible de générer les appels de loyer du mois.', {
      cause: error,
    });
  }
}

export async function deletePaymentRecord(paymentId: number) {
  try {
    const deleted = await db
      .delete(payments)
      .where(eq(payments.id, paymentId))
      .returning();
    return deleted[0] || null;
  } catch (error) {
    console.error('Database query failed in deletePaymentRecord:', error);
    throw new Error('Impossible de supprimer la quittance.', { cause: error });
  }
}

export async function deleteLeaseRecord(leaseId: number) {
  try {
    const existingLeases = await db
      .select()
      .from(leases)
      .where(eq(leases.id, leaseId));
    const targetLease = existingLeases[0];

    await db.delete(payments).where(eq(payments.leaseId, leaseId));
    const deleted = await db
      .delete(leases)
      .where(eq(leases.id, leaseId))
      .returning();

    if (targetLease) {
      const remainingLeasesForProp = await db
        .select()
        .from(leases)
        .where(eq(leases.propertyId, targetLease.propertyId));
      if (remainingLeasesForProp.length === 0) {
        await db
          .update(properties)
          .set({ status: 'vacant' })
          .where(eq(properties.id, targetLease.propertyId));
      }

      const remainingLeasesForTenant = await db
        .select()
        .from(leases)
        .where(eq(leases.tenantId, targetLease.tenantId));
      if (remainingLeasesForTenant.length === 0) {
        await db.delete(tenants).where(eq(tenants.id, targetLease.tenantId));
      }
    }

    return deleted[0] || null;
  } catch (error) {
    console.error('Database query failed in deleteLeaseRecord:', error);
    throw new Error('Impossible de supprimer le contrat de bail.', {
      cause: error,
    });
  }
}

export async function deletePropertyRecord(propertyId: number) {
  try {
    await db.delete(payments).where(eq(payments.propertyId, propertyId));
    await db.delete(leases).where(eq(leases.propertyId, propertyId));
    const deleted = await db
      .delete(properties)
      .where(eq(properties.id, propertyId))
      .returning();
    return deleted[0] || null;
  } catch (error) {
    console.error('Database query failed in deletePropertyRecord:', error);
    throw new Error('Impossible de supprimer le bien immobilier.', {
      cause: error,
    });
  }
}

export async function deleteLandlordRecord(landlordId: number) {
  try {
    await db.delete(payments).where(eq(payments.landlordId, landlordId));
    await db.delete(leases).where(eq(leases.landlordId, landlordId));
    await db.delete(properties).where(eq(properties.landlordId, landlordId));
    const deleted = await db
      .delete(landlords)
      .where(eq(landlords.id, landlordId))
      .returning();
    return deleted[0] || null;
  } catch (error) {
    console.error('Database query failed in deleteLandlordRecord:', error);
    throw new Error('Impossible de supprimer le bailleur.', { cause: error });
  }
}

export async function renamePropertyTypeInRecords(
  oldTypeName: string,
  newTypeName: string
) {
  try {
    if (!oldTypeName || !newTypeName || oldTypeName === newTypeName) {
      return [];
    }
    const updated = await db
      .update(properties)
      .set({ propertyType: newTypeName })
      .where(eq(properties.propertyType, oldTypeName))
      .returning();
    return updated;
  } catch (error) {
    console.error('Database query failed in renamePropertyTypeInRecords:', error);
    throw new Error('Impossible de renommer le type de bien sur les lots existants.', {
      cause: error,
    });
  }
}

