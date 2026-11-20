// src/server/vercel-entry.ts
import * as dotenv from "dotenv";

// src/server/create-app.ts
import express from "express";

// src/db/supabase.ts
import { createClient } from "@supabase/supabase-js";
var REQUIRED_TABLES = [
  "users",
  "landlords",
  "properties",
  "tenants",
  "leases",
  "payments",
  "app_settings"
];
var cachedAdminClient = null;
var cachedConfigSignature = "";
function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const publishableKey = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const jwksUrl = (process.env.SUPABASE_JWKS_URL || (url ? `${url.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json` : "")).trim();
  return {
    url,
    publishableKey,
    secretKey,
    jwksUrl,
    isConfigured: Boolean(url && secretKey)
  };
}
function getSupabaseAdmin() {
  const { url, secretKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return null;
  }
  const signature = `${url}|${secretKey.slice(0, 12)}`;
  if (!cachedAdminClient || cachedConfigSignature !== signature) {
    cachedAdminClient = createClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    cachedConfigSignature = signature;
  }
  return cachedAdminClient;
}
function requireSupabaseAdmin() {
  const client = getSupabaseAdmin();
  if (!client) {
    throw new Error(
      "Supabase non configur\xE9 : d\xE9finissez SUPABASE_URL et SUPABASE_SECRET_KEY."
    );
  }
  return client;
}
async function verifySupabaseAuthPassword(email, password) {
  const { url, publishableKey, secretKey } = getSupabaseConfig();
  const apiKey = publishableKey || secretKey;
  if (!url || !apiKey || !email || !password) {
    return null;
  }
  try {
    const authClient = createClient(url, apiKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password
    });
    if (error || !data?.user) {
      return null;
    }
    const meta = data.user.user_metadata || {};
    const fullName = String(meta.full_name || meta.name || "").trim() || email.split("@")[0];
    return {
      id: data.user.id,
      email: (data.user.email || email).trim().toLowerCase(),
      fullName
    };
  } catch {
    return null;
  }
}
function mapLandlordRow(row) {
  return {
    id: Number(row.id),
    userId: String(row.user_id || "global_demo"),
    fullName: String(row.full_name || ""),
    companyName: row.company_name ?? null,
    email: String(row.email || ""),
    phone: String(row.phone || ""),
    address: String(row.address || ""),
    taxId: row.tax_id ?? null,
    iban: row.iban ?? null,
    commissionRate: Number(row.commission_rate ?? 8),
    contractHeaderNote: row.contract_header_note ?? null,
    portalUsername: row.portal_username ?? null,
    portalPassword: row.portal_password ?? null,
    portalEnabled: row.portal_enabled !== false,
    portalLastLoginAt: row.portal_last_login_at ? String(row.portal_last_login_at) : null,
    createdAt: row.created_at ? String(row.created_at) : (/* @__PURE__ */ new Date()).toISOString()
  };
}
function mapPropertyRow(row) {
  return {
    id: Number(row.id),
    userId: String(row.user_id || "global_demo"),
    landlordId: Number(row.landlord_id),
    reference: String(row.reference || ""),
    title: String(row.title || ""),
    propertyType: String(row.property_type || "Appartement"),
    address: String(row.address || ""),
    city: String(row.city || ""),
    neighborhood: String(row.neighborhood || ""),
    surfaceArea: Number(row.surface_area ?? 0),
    roomsCount: Number(row.rooms_count ?? 1),
    monthlyRent: String(row.monthly_rent ?? "0"),
    chargesAmount: String(row.charges_amount ?? "0"),
    currency: String(row.currency || "FCFA"),
    latitude: Number(row.latitude ?? 0),
    longitude: Number(row.longitude ?? 0),
    postgisWkt: String(row.postgis_wkt || ""),
    status: row.status || "occupied",
    createdAt: row.created_at ? String(row.created_at) : (/* @__PURE__ */ new Date()).toISOString()
  };
}
function mapTenantRow(row) {
  return {
    id: Number(row.id),
    userId: String(row.user_id || "global_demo"),
    firstName: String(row.first_name || ""),
    lastName: String(row.last_name || ""),
    email: String(row.email || ""),
    phoneWhatsapp: String(row.phone_whatsapp || ""),
    nationalIdNumber: String(row.national_id_number || ""),
    profession: row.profession ?? null,
    employer: row.employer ?? null,
    monthlyIncome: row.monthly_income !== null && row.monthly_income !== void 0 ? String(row.monthly_income) : null,
    guarantorName: row.guarantor_name ?? null,
    guarantorPhone: row.guarantor_phone ?? null,
    dossierStatus: String(row.dossier_status || "approved"),
    createdAt: row.created_at ? String(row.created_at) : (/* @__PURE__ */ new Date()).toISOString()
  };
}
function mapLeaseRow(row) {
  return {
    id: Number(row.id),
    userId: String(row.user_id || "global_demo"),
    contractNumber: String(row.contract_number || ""),
    landlordId: Number(row.landlord_id),
    propertyId: Number(row.property_id),
    tenantId: Number(row.tenant_id),
    startDate: String(row.start_date || ""),
    endDate: row.end_date ?? null,
    rentAmount: String(row.rent_amount ?? "0"),
    chargesAmount: String(row.charges_amount ?? "0"),
    securityDeposit: String(row.security_deposit ?? "0"),
    paymentDueDay: Number(row.payment_due_day ?? 5),
    customClauses: row.custom_clauses ?? null,
    status: String(row.status || "active"),
    shareToken: String(row.share_token || ""),
    createdAt: row.created_at ? String(row.created_at) : (/* @__PURE__ */ new Date()).toISOString()
  };
}
function mapPaymentRow(row) {
  return {
    id: Number(row.id),
    userId: String(row.user_id || "global_demo"),
    receiptNumber: String(row.receipt_number || ""),
    leaseId: Number(row.lease_id),
    landlordId: Number(row.landlord_id),
    propertyId: Number(row.property_id),
    tenantId: Number(row.tenant_id),
    periodMonth: String(row.period_month || ""),
    periodLabel: String(row.period_label || ""),
    amountDue: String(row.amount_due ?? "0"),
    amountPaid: String(row.amount_paid ?? "0"),
    dueDate: String(row.due_date || ""),
    paymentDate: row.payment_date ?? null,
    paymentMethod: row.payment_method ?? null,
    status: row.status || "pending",
    daysLate: Number(row.days_late ?? 0),
    whatsappSent: Boolean(row.whatsapp_sent),
    shareToken: String(row.share_token || ""),
    createdAt: row.created_at ? String(row.created_at) : (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function checkSupabaseTablesStatus() {
  const { url, publishableKey, jwksUrl, isConfigured } = getSupabaseConfig();
  let projectHost = "";
  try {
    if (url) {
      projectHost = new URL(url).host;
    }
  } catch {
    projectHost = "";
  }
  const client = getSupabaseAdmin();
  if (!client || !isConfigured) {
    return {
      configured: false,
      mode: "direct_supabase",
      projectHost,
      hasPublishableKey: Boolean(publishableKey),
      jwksConfigured: Boolean(jwksUrl),
      tablesReady: false,
      existingTables: [],
      missingTables: [...REQUIRED_TABLES],
      permissionDeniedTables: []
    };
  }
  const existingTables = [];
  const missingTables = [];
  const permissionDeniedTables = [];
  await Promise.all(
    REQUIRED_TABLES.map(async (tableName) => {
      const { error } = await client.from(tableName).select("*").limit(1);
      if (!error) {
        existingTables.push(tableName);
      } else if (error.code === "42501") {
        existingTables.push(tableName);
        permissionDeniedTables.push(tableName);
      } else {
        missingTables.push(tableName);
      }
    })
  );
  return {
    configured: true,
    mode: "direct_supabase",
    projectHost,
    hasPublishableKey: Boolean(publishableKey),
    jwksConfigured: Boolean(jwksUrl),
    tablesReady: missingTables.length === 0 && permissionDeniedTables.length === 0,
    existingTables: existingTables.sort(),
    missingTables: missingTables.sort(),
    permissionDeniedTables: permissionDeniedTables.sort()
  };
}
async function loadAppSettingsFromSupabase(rowId) {
  const client = requireSupabaseAdmin();
  const { data, error } = await client.from("app_settings").select("store_json").eq("id", rowId).maybeSingle();
  if (error) {
    throw new Error(`Supabase app_settings read failed: ${error.message}`);
  }
  return data?.store_json ? String(data.store_json) : null;
}
async function saveAppSettingsToSupabase(rowId, storeJson) {
  const client = requireSupabaseAdmin();
  const { error } = await client.from("app_settings").upsert(
    {
      id: rowId,
      store_json: storeJson,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    { onConflict: "id" }
  );
  if (error) {
    throw new Error(`Supabase app_settings write failed: ${error.message}`);
  }
}

// src/lib/agency-notifications.ts
var WHATSAPP_COUNTRY_RULES = [
  {
    code: "225",
    iso: "CI",
    label: "C\xF4te d\u2019Ivoire (+225)",
    placeholder: "07 08 09 10 11",
    nationalLengths: [10],
    keepLeadingZero: true,
    validPrefixes: ["01", "05", "07", "21", "25", "27"],
    exampleFormatted: "+225 07 08 09 10 11"
  },
  {
    code: "221",
    iso: "SN",
    label: "S\xE9n\xE9gal (+221)",
    placeholder: "77 123 45 67",
    nationalLengths: [9],
    keepLeadingZero: false,
    validPrefixes: ["70", "75", "76", "77", "78", "33"],
    exampleFormatted: "+221 77 123 45 67"
  },
  {
    code: "223",
    iso: "ML",
    label: "Mali (+223)",
    placeholder: "76 12 34 56",
    nationalLengths: [8],
    keepLeadingZero: false,
    validPrefixes: ["5", "6", "7", "8", "9", "2", "4"],
    exampleFormatted: "+223 76 12 34 56"
  },
  {
    code: "226",
    iso: "BF",
    label: "Burkina Faso (+226)",
    placeholder: "70 12 34 56",
    nationalLengths: [8],
    keepLeadingZero: false,
    validPrefixes: ["5", "6", "7", "0", "2"],
    exampleFormatted: "+226 70 12 34 56"
  },
  {
    code: "229",
    iso: "BJ",
    label: "B\xE9nin (+229)",
    placeholder: "01 97 12 34 56",
    nationalLengths: [10],
    keepLeadingZero: true,
    validPrefixes: ["01"],
    exampleFormatted: "+229 01 97 12 34 56"
  },
  {
    code: "228",
    iso: "TG",
    label: "Togo (+228)",
    placeholder: "90 12 34 56",
    nationalLengths: [8],
    keepLeadingZero: false,
    validPrefixes: ["7", "9", "2"],
    exampleFormatted: "+228 90 12 34 56"
  },
  {
    code: "227",
    iso: "NE",
    label: "Niger (+227)",
    placeholder: "96 12 34 56",
    nationalLengths: [8],
    keepLeadingZero: false,
    validPrefixes: ["7", "8", "9", "2"],
    exampleFormatted: "+227 96 12 34 56"
  },
  {
    code: "224",
    iso: "GN",
    label: "Guin\xE9e (+224)",
    placeholder: "622 12 34 56",
    nationalLengths: [9],
    keepLeadingZero: false,
    validPrefixes: ["6"],
    exampleFormatted: "+224 622 12 34 56"
  },
  {
    code: "237",
    iso: "CM",
    label: "Cameroun (+237)",
    placeholder: "6 99 12 34 56",
    nationalLengths: [9],
    keepLeadingZero: false,
    validPrefixes: ["6", "2"],
    exampleFormatted: "+237 6 99 12 34 56"
  },
  {
    code: "241",
    iso: "GA",
    label: "Gabon (+241)",
    placeholder: "07 12 34 56",
    nationalLengths: [7, 8, 9],
    keepLeadingZero: false,
    exampleFormatted: "+241 77 12 34 56"
  },
  {
    code: "242",
    iso: "CG",
    label: "Congo (+242)",
    placeholder: "06 123 45 67",
    nationalLengths: [9],
    keepLeadingZero: true,
    validPrefixes: ["04", "05", "06", "22"],
    exampleFormatted: "+242 06 123 45 67"
  },
  {
    code: "243",
    iso: "CD",
    label: "RD Congo (+243)",
    placeholder: "81 234 56 78",
    nationalLengths: [9],
    keepLeadingZero: false,
    validPrefixes: ["8", "9"],
    exampleFormatted: "+243 81 234 56 78"
  },
  {
    code: "212",
    iso: "MA",
    label: "Maroc (+212)",
    placeholder: "6 12 34 56 78",
    nationalLengths: [9],
    keepLeadingZero: false,
    validPrefixes: ["5", "6", "7"],
    exampleFormatted: "+212 6 12 34 56 78"
  },
  {
    code: "216",
    iso: "TN",
    label: "Tunisie (+216)",
    placeholder: "20 123 456",
    nationalLengths: [8],
    keepLeadingZero: false,
    exampleFormatted: "+216 20 123 456"
  },
  {
    code: "213",
    iso: "DZ",
    label: "Alg\xE9rie (+213)",
    placeholder: "5 51 23 45 67",
    nationalLengths: [9],
    keepLeadingZero: false,
    validPrefixes: ["5", "6", "7"],
    exampleFormatted: "+213 5 51 23 45 67"
  },
  {
    code: "33",
    iso: "FR",
    label: "France (+33)",
    placeholder: "6 12 34 56 78",
    nationalLengths: [9],
    keepLeadingZero: false,
    validPrefixes: ["6", "7", "1", "2", "3", "4", "5", "9"],
    exampleFormatted: "+33 6 12 34 56 78"
  },
  {
    code: "32",
    iso: "BE",
    label: "Belgique (+32)",
    placeholder: "470 12 34 56",
    nationalLengths: [9],
    keepLeadingZero: false,
    validPrefixes: ["4"],
    exampleFormatted: "+32 470 12 34 56"
  },
  {
    code: "41",
    iso: "CH",
    label: "Suisse (+41)",
    placeholder: "79 123 45 67",
    nationalLengths: [9],
    keepLeadingZero: false,
    validPrefixes: ["7"],
    exampleFormatted: "+41 79 123 45 67"
  },
  {
    code: "1",
    iso: "US",
    label: "Canada / USA (+1)",
    placeholder: "514 555 0199",
    nationalLengths: [10],
    keepLeadingZero: false,
    exampleFormatted: "+1 514 555 0199"
  }
];
function formatNationalPairs(national) {
  if (national.length % 2 === 0) {
    return national.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }
  if (national.length === 9) {
    return `${national.slice(0, 1)} ${national.slice(1).replace(/(\d{2})(?=\d)/g, "$1 ").trim()}`;
  }
  return national;
}
function detectRuleFromLeadingDigits(digits) {
  const sorted = [...WHATSAPP_COUNTRY_RULES].sort(
    (a, b) => b.code.length - a.code.length
  );
  return sorted.find((r) => digits.startsWith(r.code));
}
function validateWhatsAppPhone(rawInput, defaultCountryCode = "225") {
  const trimmed = String(rawInput || "").replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "").trim();
  const fallbackRule = WHATSAPP_COUNTRY_RULES.find((r) => r.code === defaultCountryCode) || WHATSAPP_COUNTRY_RULES[0];
  if (!trimmed) {
    return {
      isValid: false,
      e164: "",
      waDigits: "",
      formattedDisplay: "",
      countryCode: fallbackRule.code,
      countryLabel: fallbackRule.label,
      error: `Veuillez saisir un num\xE9ro WhatsApp valide (ex : ${fallbackRule.exampleFormatted}).`
    };
  }
  if (/[a-zA-Z]/.test(trimmed)) {
    return {
      isValid: false,
      e164: "",
      waDigits: "",
      formattedDisplay: trimmed,
      countryCode: fallbackRule.code,
      countryLabel: fallbackRule.label,
      error: "Le num\xE9ro WhatsApp ne doit contenir que des chiffres (et \xE9ventuellement l\u2019indicatif +...)."
    };
  }
  const cleanedParenZero = trimmed.replace(/\(0\)/g, "0");
  const hasExplicitIntlPrefix = cleanedParenZero.startsWith("+") || cleanedParenZero.startsWith("00");
  let digits = cleanedParenZero.replace(/\D+/g, "");
  if (cleanedParenZero.startsWith("00")) {
    digits = digits.slice(2);
  }
  if (!digits || digits.length < 8) {
    return {
      isValid: false,
      e164: "",
      waDigits: "",
      formattedDisplay: trimmed,
      countryCode: fallbackRule.code,
      countryLabel: fallbackRule.label,
      error: `Num\xE9ro WhatsApp trop court. Format attendu pour ${fallbackRule.label} : ${fallbackRule.exampleFormatted}.`
    };
  }
  let activeRule = fallbackRule;
  let national = digits;
  if (hasExplicitIntlPrefix) {
    const matched = detectRuleFromLeadingDigits(digits);
    if (matched) {
      activeRule = matched;
      national = digits.slice(matched.code.length);
      if (national.startsWith(`00${matched.code}`)) {
        national = national.slice(matched.code.length + 2);
      } else if (national.startsWith(matched.code) && national.length - matched.code.length >= Math.min(...matched.nationalLengths)) {
        national = national.slice(matched.code.length);
      }
    } else {
      if (digits.startsWith("0") || digits.length < 10 || digits.length > 15) {
        return {
          isValid: false,
          e164: "",
          waDigits: "",
          formattedDisplay: trimmed,
          countryCode: defaultCountryCode,
          countryLabel: "International",
          error: "Indicatif ou num\xE9ro international WhatsApp non conforme (8 \xE0 15 chiffres requis au format +IndicatifNum\xE9ro)."
        };
      }
      if (/^(\d)\1{6,}$/.test(digits.slice(-8))) {
        return {
          isValid: false,
          e164: "",
          waDigits: "",
          formattedDisplay: trimmed,
          countryCode: defaultCountryCode,
          countryLabel: "International",
          error: "Ce num\xE9ro WhatsApp semble fictif ou non conforme."
        };
      }
      return {
        isValid: true,
        e164: `+${digits}`,
        waDigits: digits,
        formattedDisplay: `+${digits}`,
        countryCode: digits.slice(0, 3),
        countryLabel: "International"
      };
    }
  } else {
    if (digits.startsWith(fallbackRule.code) && fallbackRule.nationalLengths.includes(digits.length - fallbackRule.code.length)) {
      national = digits.slice(fallbackRule.code.length);
    } else {
      const matchedOther = detectRuleFromLeadingDigits(digits);
      if (matchedOther && !fallbackRule.nationalLengths.includes(digits.length) && matchedOther.nationalLengths.includes(digits.length - matchedOther.code.length)) {
        activeRule = matchedOther;
        national = digits.slice(matchedOther.code.length);
      }
    }
  }
  if (activeRule.code === "225") {
    if (national.length === 9 && /^[157]/.test(national)) {
      national = `0${national}`;
    }
    if (national.length !== 10) {
      return {
        isValid: false,
        e164: "",
        waDigits: "",
        formattedDisplay: trimmed,
        countryCode: activeRule.code,
        countryLabel: activeRule.label,
        error: `Num\xE9ro WhatsApp C\xF4te d\u2019Ivoire (+225) non conforme : 10 chiffres requis (vous en avez saisi ${national.length}). Exemple : ${activeRule.exampleFormatted}.`
      };
    }
    const prefix2 = national.slice(0, 2);
    if (!["01", "05", "07", "21", "25", "27"].includes(prefix2)) {
      return {
        isValid: false,
        e164: "",
        waDigits: "",
        formattedDisplay: trimmed,
        countryCode: activeRule.code,
        countryLabel: activeRule.label,
        error: `Pr\xE9fixe \xAB ${prefix2} \xBB non conforme pour la C\xF4te d\u2019Ivoire (+225). Le num\xE9ro doit commencer par 01, 05 ou 07 (ex : ${activeRule.exampleFormatted}).`
      };
    }
  } else if (activeRule.code === "229") {
    if (national.length === 8 && !national.startsWith("01")) {
      national = `01${national}`;
    }
    if (national.length !== 10 || !national.startsWith("01")) {
      return {
        isValid: false,
        e164: "",
        waDigits: "",
        formattedDisplay: trimmed,
        countryCode: activeRule.code,
        countryLabel: activeRule.label,
        error: `Num\xE9ro WhatsApp B\xE9nin (+229) non conforme : 10 chiffres commen\xE7ant par 01 requis (ex : ${activeRule.exampleFormatted}).`
      };
    }
  } else if (!activeRule.keepLeadingZero) {
    if (national.startsWith("0") && activeRule.nationalLengths.includes(national.length - 1)) {
      national = national.slice(1);
    }
  }
  if (!activeRule.nationalLengths.includes(national.length)) {
    const expectedStr = activeRule.nationalLengths.join(" ou ");
    return {
      isValid: false,
      e164: "",
      waDigits: "",
      formattedDisplay: trimmed,
      countryCode: activeRule.code,
      countryLabel: activeRule.label,
      error: `Num\xE9ro WhatsApp non conforme pour ${activeRule.label} : ${expectedStr} chiffres attendus apr\xE8s +${activeRule.code} (ex : ${activeRule.exampleFormatted}).`
    };
  }
  if (activeRule.validPrefixes && !activeRule.validPrefixes.some((p) => national.startsWith(p))) {
    return {
      isValid: false,
      e164: "",
      waDigits: "",
      formattedDisplay: trimmed,
      countryCode: activeRule.code,
      countryLabel: activeRule.label,
      error: `Num\xE9ro WhatsApp non conforme pour ${activeRule.label}. Exemple attendu : ${activeRule.exampleFormatted}.`
    };
  }
  const subscriberTail = national.slice(-7);
  if (/^0{7,}$/.test(subscriberTail) || /^(\d)\1{7,}$/.test(national)) {
    return {
      isValid: false,
      e164: "",
      waDigits: "",
      formattedDisplay: trimmed,
      countryCode: activeRule.code,
      countryLabel: activeRule.label,
      error: `Ce num\xE9ro WhatsApp (${trimmed}) est un num\xE9ro fictif de d\xE9monstration. Veuillez saisir un vrai num\xE9ro WhatsApp actif.`
    };
  }
  const waDigits = `${activeRule.code}${national}`;
  const e164 = `+${waDigits}`;
  const formattedDisplay = `+${activeRule.code} ${formatNationalPairs(national)}`;
  return {
    isValid: true,
    e164,
    waDigits,
    formattedDisplay,
    countryCode: activeRule.code,
    countryLabel: activeRule.label
  };
}
function sanitizeWhatsAppNumber(rawPhone, defaultCountryCode = "225") {
  const firstCandidate = String(rawPhone || "").split("/")[0]?.trim() || "";
  const validated = validateWhatsAppPhone(firstCandidate, defaultCountryCode);
  if (validated.isValid) {
    return validated.waDigits;
  }
  let digits = firstCandidate.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  if (digits.length === 10 && /^(01|05|07|21|25|27)/.test(digits)) {
    return `225${digits}`;
  }
  if (digits.length === 12 && /^225[157]/.test(digits)) {
    return `2250${digits.slice(3)}`;
  }
  if (digits.length === 10 && /^0[67]/.test(digits)) {
    return `33${digits.slice(1)}`;
  }
  if (/^(33|212|243|32|41|213)0\d{9}$/.test(digits)) {
    const prefixMatch = digits.match(/^(33|212|243|32|41|213)0(\d{9})$/);
    if (prefixMatch) {
      return `${prefixMatch[1]}${prefixMatch[2]}`;
    }
  }
  return digits;
}

// src/lib/document-templates.ts
var DEFAULT_MANAGEMENT_COMPANY = {
  companyName: "GIMMO PRESTIGE IMMOBILIER SARL",
  tradeName: "GIMMO GESTION & PATRIMOINE",
  legalForm: "SARL au capital de 10 000 000 FCFA",
  rccm: "CI-ABJ-03-2024-B12-04892",
  taxId: "CC 2408915 M",
  licenseNumber: "Agr\xE9ment Minist\xE9riel MCLU N\xB0 0184/MCLU/DGLCV/AG",
  managerName: "M. Ghislain Assamoi",
  managerTitle: "Directeur G\xE9n\xE9ral & Administrateur de Biens",
  address: "Boulevard Latrille, Cocody Deux-Plateaux Vallons, Immeuble Prestige 3e \xE9tage",
  city: "Abidjan \u2014 C\xF4te d\u2019Ivoire",
  phone: "+225 07 07 00 11 22 / +225 27 22 41 00 00",
  email: "assamoighislain@gmail.com",
  website: "www.gimmo-prestige.ci",
  bankInfo: "SGBCI CI008 01111 012345678901 88 \xB7 Orange Money Marchand : #144*821#",
  headerSlogan: "Soci\xE9t\xE9 de G\xE9rance Locative, Syndic de Copropri\xE9t\xE9 & Administration de Patrimoine Immobilier",
  updatedAt: "2026-11-01T00:00:00.000Z"
};
var DEFAULT_SAAS_TENANTS = [
  {
    id: "tenant_gimmo_prestige",
    companyName: "GIMMO PRESTIGE IMMOBILIER SARL",
    tradeName: "GIMMO GESTION & PATRIMOINE",
    legalForm: "SARL au capital de 10 000 000 FCFA",
    rccm: "CI-ABJ-03-2024-B12-04892",
    taxId: "CC 2408915 M",
    licenseNumber: "Agr\xE9ment MCLU N\xB0 0184/MCLU/DGLCV/AG",
    managerName: "M. Ghislain Assamoi",
    ownerEmail: "assamoighislain@gmail.com",
    phone: "+225 07 07 00 11 22",
    whatsappPhone: "+225 07 07 00 11 22",
    address: "Cocody Deux-Plateaux Vallons, Boulevard Latrille",
    city: "Abidjan",
    plan: "enterprise",
    status: "active",
    monthlyFeeFcfa: 15e4,
    maxProperties: 500,
    maxLandlords: 100,
    subscriptionEndsAt: "2027-12-31",
    isCurrentTenant: true,
    createdAt: "2026-01-10T00:00:00.000Z"
  }
];
var DEFAULT_SAAS_USERS = [
  {
    id: "user_super_admin_main",
    fullName: "Ghislain Assamoi",
    email: "assamoighislain@gmail.com",
    role: "super_admin",
    tenantId: "tenant_gimmo_prestige",
    tenantName: "GIMMO PRESTIGE IMMOBILIER SARL",
    status: "active",
    lastLoginAt: "2026-11-13T08:30:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z"
  }
];
var DEFAULT_LEASE_TEMPLATE = {
  presetId: "habitation_standard",
  accentColor: "#1E1B4B",
  documentTitle: "CONTRAT DE BAIL LOCATIF",
  documentSubtitle: "Contrat N\xB0 {{numero_contrat}} \u2014 \xC9tabli pour {{nom_bailleur}} par {{nom_societe_gestion}}",
  showPostgisCoords: true,
  article1Title: "ARTICLE 1 : D\xC9SIGNATION DES PARTIES & MANDATAIRE",
  article1Body: "ENTRE LE BAILLEUR : {{nom_bailleur}}, immatricul\xE9 sous le N\xB0 {{id_fiscal_bailleur}}, demeurant \xE0 {{adresse_bailleur}}, T\xE9l\xE9phone : {{telephone_bailleur}}, repr\xE9sent\xE9 aux pr\xE9sentes par son mandataire exclusif la soci\xE9t\xE9 {{nom_societe_gestion}} (RCCM : {{rccm_societe_gestion}}, {{agrement_societe_gestion}}), sise \xE0 {{adresse_societe_gestion}}, T\xE9l : {{telephone_societe_gestion}}.\n\nET LE PRENEUR (LOCATAIRE) : M./Mme {{nom_locataire}}, titulaire de la pi\xE8ce d\u2019identit\xE9 N\xB0 {{cni_locataire}}, exer\xE7ant la profession de {{profession_locataire}} ({{employeur_locataire}}), joignable sur WhatsApp au {{whatsapp_locataire}} et par email \xE0 {{email_locataire}}.",
  article2Title: "ARTICLE 2 : D\xC9SIGNATION ET G\xC9OLOCALISATION DU BIEN",
  article2Body: "R\xE9f\xE9rence : {{reference_bien}} \u2014 {{titre_bien}} ({{type_bien}})\nSituation g\xE9ographique : {{adresse_bien}}, Quartier {{quartier_bien}}, {{ville_bien}}.\nConsistance : Superficie de {{surface_bien}} m\xB2 comprenant {{pieces_bien}} pi\xE8ces principales.",
  article3Title: "ARTICLE 3 : DUR\xC9E ET PRISE D\u2019EFFET",
  article3Body: "Le pr\xE9sent bail prend effet le {{date_debut}} et se terminera le {{date_fin}}, sauf d\xE9nonciation par l\u2019une des parties dans le respect du pr\xE9avis l\xE9gal de trois (3) mois.",
  article4Title: "ARTICLE 4 : LOYER, CHARGES ET D\xC9P\xD4T DE GARANTIE",
  article4Body: "\u2022 Loyer mensuel principal : {{loyer_mensuel}}\n\u2022 Provision mensuelle sur charges : {{charges}}\n\u2022 Total mensuel exigible : {{total_mensuel}} payable d\u2019avance au plus tard le {{jour_echeance}} de chaque mois aupr\xE8s de {{nom_societe_gestion}}.\n\u2022 D\xE9p\xF4t de garantie (Caution) vers\xE9 \xE0 la signature : {{caution}}.",
  article5Title: "ARTICLE 5 : DISPOSITIONS PARTICULI\xC8RES DU BAILLEUR",
  article5Body: "{{note_bailleur}}\n\nClauses additionnelles du contrat : {{clauses_contrat}}",
  article6Title: "ARTICLE 6 : ENTRETIEN, ASSURANCE ET R\xC9SILIATION",
  article6Body: "Le Preneur s\u2019engage \xE0 user des lieux lou\xE9s en bon p\xE8re de famille, \xE0 souscrire une assurance multirisque habitation d\xE8s la remise des cl\xE9s et \xE0 ne proc\xE9der \xE0 aucune transformation sans l\u2019accord \xE9crit pr\xE9alable du Bailleur ou de {{nom_societe_gestion}}.",
  landlordSignatureLabel: "POUR LE BAILLEUR ({{nom_societe_gestion}})",
  tenantSignatureLabel: "LE PRENEUR (Locataire)",
  signatureSubtext: "Signature pr\xE9c\xE9d\xE9e de la mention \xAB Lu et approuv\xE9 \xBB",
  footerText: "{{nom_societe_gestion}} \xB7 RCCM {{rccm_societe_gestion}} \xB7 Jeton d\u2019authenticit\xE9 : {{jeton_partage}}"
};
var LEASE_PRESETS = {
  habitation_standard: {
    label: "Bail d\u2019Habitation Standard (CI / OHADA)",
    description: "Mod\xE8le complet avec clauses r\xE9sidentielles, d\xE9p\xF4t de garantie et pr\xE9avis de 3 mois.",
    config: DEFAULT_LEASE_TEMPLATE
  },
  commercial_ohada: {
    label: "Bail \xE0 Usage Professionnel / Commercial (AUDCG OHADA)",
    description: "Adapt\xE9 aux bureaux, boutiques et locaux commerciaux avec r\xE9vision triennale et droit au renouvellement.",
    config: {
      ...DEFAULT_LEASE_TEMPLATE,
      presetId: "commercial_ohada",
      accentColor: "#0F172A",
      documentTitle: "CONTRAT DE BAIL \xC0 USAGE PROFESSIONNEL (OHADA)",
      documentSubtitle: "Bail Commercial N\xB0 {{numero_contrat}} \u2014 R\xE9gime Acte Uniforme OHADA \u2014 {{nom_bailleur}}",
      article3Title: "ARTICLE 3 : DUR\xC9E, RENOUVELLEMENT ET PR\xC9AVIS COMMERCIAL",
      article3Body: "Le pr\xE9sent bail professionnel prend effet le {{date_debut}} pour se terminer le {{date_fin}}. Conform\xE9ment aux dispositions de l\u2019Acte Uniforme OHADA portant sur le Droit Commercial G\xE9n\xE9ral, toute demande de renouvellement ou de cong\xE9 devra \xEAtre notifi\xE9e au moins six (6) mois avant l\u2019expiration du bail.",
      article6Title: "ARTICLE 6 : DESTINATION DES LIEUX ET ENSEIGNE COMMERCIALE",
      article6Body: "Les locaux lou\xE9s sont exclusivement destin\xE9s \xE0 l\u2019exercice de l\u2019activit\xE9 professionnelle du Preneur. Toute pose d\u2019enseigne ext\xE9rieure ou am\xE9nagement technique devra respecter les r\xE8gles d\u2019urbanisme et de copropri\xE9t\xE9 de {{ville_bien}}."
    }
  },
  meuble_courte_duree: {
    label: "Bail R\xE9sidence Meubl\xE9e & \xC9quip\xE9e",
    description: "Id\xE9al pour les studios haut standing, appartements meubl\xE9s et villas avec inventaire mobilier.",
    config: {
      ...DEFAULT_LEASE_TEMPLATE,
      presetId: "meuble_courte_duree",
      accentColor: "#065F46",
      documentTitle: "CONTRAT DE LOCATION MEUBL\xC9E",
      documentSubtitle: "Convention de Location Meubl\xE9e N\xB0 {{numero_contrat}} \u2014 {{nom_bailleur}}",
      article3Title: "ARTICLE 3 : DUR\xC9E DE LA LOCATION MEUBL\xC9E",
      article3Body: "La pr\xE9sente location meubl\xE9e est consentie du {{date_debut}} au {{date_fin}}. Le pr\xE9avis de d\xE9part du Locataire est fix\xE9 \xE0 un (1) mois par notification \xE9crite.",
      article6Title: "ARTICLE 6 : INVENTAIRE DU MOBILIER ET \xC9TAT DES LIEUX",
      article6Body: "Un inventaire contradictoire des \xE9quipements, appareils \xE9lectrom\xE9nagers et meubles garnissant le bien {{titre_bien}} est annex\xE9 au pr\xE9sent contrat. Le Preneur s\u2019engage \xE0 les restituer en parfait \xE9tat de fonctionnement."
    }
  }
};
var DEFAULT_RECEIPT_TEMPLATE = {
  presetId: "quittance_classique",
  accentColor: "#0F172A",
  agencyBrandTitle: "{{nom_societe_gestion}}",
  agencyBrandSubtitle: "{{adresse_societe_gestion}} \xB7 T\xE9l : {{telephone_societe_gestion}}",
  documentTitle: "QUITTANCE DE LOYER",
  rentRowLabel: "Loyer nu mensuel ({{periode}})",
  chargesRowLabel: "Provision sur charges locatives (syndic, entretien, s\xE9curit\xE9)",
  attestationBody: "Nous soussign\xE9s, {{nom_societe_gestion}}, agissant en qualit\xE9 de mandataire de {{nom_bailleur}}, reconnaissons avoir re\xE7u de {{nom_locataire}} la somme de {{montant_paye}} au titre du loyer et des charges pour la p\xE9riode de {{periode}} concernant le bien {{titre_bien}} situ\xE9 \xE0 {{adresse_bien}}, {{quartier_bien}}.\n\nCette quittance annule tous les re\xE7us qui auraient pu \xEAtre \xE9tablis pr\xE9c\xE9demment en cas de paiement partiel de la pr\xE9sente \xE9ch\xE9ance.",
  signatureLabel: "Pour la Soci\xE9t\xE9 de Gestion {{nom_societe_gestion}} (Cachet & Signature)",
  footerNote: "{{nom_societe_gestion}} \xB7 RCCM {{rccm_societe_gestion}} \xB7 ID Fiscal {{id_fiscal_societe_gestion}} \xB7 Jeton : {{jeton_partage}}"
};
var RECEIPT_PRESETS = {
  quittance_classique: {
    label: "Quittance de Loyer Officielle (Standard)",
    description: "Quittance d\xE9taill\xE9e distinguant le loyer nu et la provision pour charges avec attestation l\xE9gale.",
    config: DEFAULT_RECEIPT_TEMPLATE
  },
  facture_commerciale: {
    label: "Facture de Loyer Acquitt\xE9e (Bail Commercial)",
    description: "Pr\xE9sentation orient\xE9e comptabilit\xE9 d\u2019entreprise et baux professionnels avec r\xE9f\xE9rences fiscales.",
    config: {
      ...DEFAULT_RECEIPT_TEMPLATE,
      presetId: "facture_commerciale",
      accentColor: "#1E1B4B",
      documentTitle: "FACTURE DE LOYER ACQUITT\xC9E",
      rentRowLabel: "Redevance locative mensuelle H.T. / T.T.C. ({{periode}})",
      chargesRowLabel: "Prestations d\u2019immeuble, gardiennage et charges communes",
      attestationBody: "Facture acquitt\xE9e \xE9mise par {{nom_societe_gestion}} pour le compte de {{nom_bailleur}} (ID Fiscal : {{id_fiscal_bailleur}}) au profit du preneur {{nom_locataire}} pour un montant r\xE9gl\xE9 de {{montant_paye}} par {{mode_paiement}} en date du {{date_paiement}}, couvrant l\u2019\xE9ch\xE9ance locative de {{periode}} pour le local {{titre_bien}} ({{reference_bien}}).",
      signatureLabel: "La Direction Comptable & G\xE9rance ({{nom_societe_gestion}})"
    }
  },
  recu_compact: {
    label: "Re\xE7u d\u2019Encaissement & Quittance Express",
    description: "Formulation directe et synth\xE9tique id\xE9ale pour les envois rapides sur WhatsApp.",
    config: {
      ...DEFAULT_RECEIPT_TEMPLATE,
      presetId: "recu_compact",
      accentColor: "#065F46",
      documentTitle: "RE\xC7U & QUITTANCE DE LOYER",
      rentRowLabel: "Loyer principal p\xE9riode {{periode}}",
      chargesRowLabel: "Charges locatives forfaitaires",
      attestationBody: "Re\xE7u de M./Mme {{nom_locataire}} la somme de {{montant_paye}} (sur {{montant_appele}} appel\xE9s) aupr\xE8s de {{nom_societe_gestion}} pour le loyer de {{periode}} du bien {{titre_bien}} ({{quartier_bien}}). Reste \xE0 payer sur la p\xE9riode : {{reste_a_payer}}.",
      signatureLabel: "Visa du Gestionnaire Mandataire ({{nom_societe_gestion}})"
    }
  }
};
var DEFAULT_ACCOUNTING_MONTHS = [
  {
    periodMonth: "2026-12",
    periodLabel: "D\xE9cembre 2026",
    defaultDueDay: 5,
    status: "open",
    isCurrent: false,
    createdAt: "2026-11-01T00:00:00.000Z"
  },
  {
    periodMonth: "2026-11",
    periodLabel: "Novembre 2026",
    defaultDueDay: 5,
    status: "open",
    isCurrent: true,
    createdAt: "2026-11-01T00:00:00.000Z"
  },
  {
    periodMonth: "2026-10",
    periodLabel: "Octobre 2026",
    defaultDueDay: 5,
    status: "closed",
    isCurrent: false,
    createdAt: "2026-10-01T00:00:00.000Z"
  }
];
var DEFAULT_PROPERTY_TYPES = [
  {
    id: "type_appartement",
    name: "Appartement",
    code: "APPT",
    category: "habitation",
    defaultCharges: "45000",
    description: "Logement r\xE9sidentiel en immeuble collectif avec syndic et parties communes",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "type_villa",
    name: "Villa",
    code: "VILLA",
    category: "habitation",
    defaultCharges: "80000",
    description: "Maison individuelle ou villa duplex avec jardin privatif et d\xE9pendance",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "type_bureau",
    name: "Bureau",
    code: "BUR",
    category: "professionnel",
    defaultCharges: "75000",
    description: "Plateau professionnel ou espace de travail tertiaire climatis\xE9",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "type_local_commercial",
    name: "Local Commercial",
    code: "COM",
    category: "commercial",
    defaultCharges: "50000",
    description: "Boutique, showroom ou magasin en rez-de-chauss\xE9e avec vitrine sur rue",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "type_studio",
    name: "Studio",
    code: "STD",
    category: "habitation",
    defaultCharges: "20000",
    description: "Logement compact de 1 \xE0 2 pi\xE8ces adapt\xE9 aux jeunes actifs et \xE9tudiants",
    createdAt: "2026-01-01T00:00:00.000Z"
  }
];
function createInitialTemplatesStore() {
  return {
    leases: {
      default: { ...DEFAULT_LEASE_TEMPLATE }
    },
    receipts: {
      default: { ...DEFAULT_RECEIPT_TEMPLATE }
    },
    accountingMonths: [...DEFAULT_ACCOUNTING_MONTHS],
    propertyTypes: [...DEFAULT_PROPERTY_TYPES],
    managementCompany: { ...DEFAULT_MANAGEMENT_COMPANY },
    saasTenants: [...DEFAULT_SAAS_TENANTS],
    saasUsers: [...DEFAULT_SAAS_USERS],
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function resolveManagementCompany(store) {
  if (store?.managementCompany && store.managementCompany.companyName) {
    return {
      ...DEFAULT_MANAGEMENT_COMPANY,
      ...store.managementCompany
    };
  }
  return { ...DEFAULT_MANAGEMENT_COMPANY };
}
function resolveSaaSTenants(store) {
  if (store?.saasTenants && store.saasTenants.length > 0) {
    return [...store.saasTenants];
  }
  return [...DEFAULT_SAAS_TENANTS];
}
function resolveSaaSUsers(store) {
  if (store?.saasUsers && store.saasUsers.length > 0) {
    return [...store.saasUsers];
  }
  return [...DEFAULT_SAAS_USERS];
}
function resolveAccountingMonths(store) {
  if (store?.accountingMonths && store.accountingMonths.length > 0) {
    return [...store.accountingMonths].sort(
      (a, b) => b.periodMonth.localeCompare(a.periodMonth)
    );
  }
  return [...DEFAULT_ACCOUNTING_MONTHS];
}
function resolvePropertyTypes(store) {
  if (store?.propertyTypes && store.propertyTypes.length > 0) {
    return [...store.propertyTypes];
  }
  return [...DEFAULT_PROPERTY_TYPES];
}
function resolveLeaseTemplate(store, landlordId) {
  if (!store || !store.leases) return { ...DEFAULT_LEASE_TEMPLATE };
  if (landlordId && store.leases[`landlord_${landlordId}`]) {
    return {
      ...DEFAULT_LEASE_TEMPLATE,
      ...store.leases[`landlord_${landlordId}`]
    };
  }
  return {
    ...DEFAULT_LEASE_TEMPLATE,
    ...store.leases.default || {}
  };
}
function resolveReceiptTemplate(store, landlordId) {
  if (!store || !store.receipts) return { ...DEFAULT_RECEIPT_TEMPLATE };
  if (landlordId && store.receipts[`landlord_${landlordId}`]) {
    return {
      ...DEFAULT_RECEIPT_TEMPLATE,
      ...store.receipts[`landlord_${landlordId}`]
    };
  }
  return {
    ...DEFAULT_RECEIPT_TEMPLATE,
    ...store.receipts.default || {}
  };
}
function interpolateTemplateVariables(templateText, variables) {
  if (!templateText) return "";
  return templateText.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key) => {
    const val = variables[key];
    return val !== void 0 && val !== null ? String(val) : "";
  });
}

// src/lib/landlord-portal.ts
var PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateLandlordPortalPassword() {
  const digits = Array.from(
    { length: 4 },
    () => Math.floor(2 + Math.random() * 8).toString()
  ).join("");
  const letters = Array.from(
    { length: 3 },
    () => PASSWORD_ALPHABET[Math.floor(Math.random() * 24)]
  ).join("");
  return `GIM-${digits}-${letters}`;
}
function deriveDefaultLandlordUsername(params) {
  const cleanEmail = (params.email || "").trim().toLowerCase();
  if (cleanEmail) {
    return cleanEmail;
  }
  const slug = (params.fullName || "proprietaire").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
  const lastDigits = (params.phone || "").replace(/\D+/g, "").slice(-4) || "2026";
  return `${slug || "bailleur"}.${lastDigits}`;
}
function buildLandlordPortalWhatsAppDetails(params) {
  const { landlord, agencyName } = params;
  const rawPhone = (landlord.phone || "").split("/")[0].trim();
  const waValidation = validateWhatsAppPhone(rawPhone, "225");
  const sanitizedDigits = waValidation.isValid ? waValidation.waDigits : sanitizeWhatsAppNumber(rawPhone, "225");
  const whatsappPhoneDisplay = waValidation.isValid ? waValidation.formattedDisplay : rawPhone;
  const portalUsername = (params.overrideUsername ?? landlord.portalUsername ?? "").trim() || deriveDefaultLandlordUsername({
    email: landlord.email,
    phone: landlord.phone,
    fullName: landlord.fullName
  });
  const portalPassword = (params.overridePassword ?? landlord.portalPassword ?? "").trim() || "Non g\xE9n\xE9r\xE9";
  const resolvedOrigin = params.baseUrl?.replace(/\/$/, "") || (typeof window !== "undefined" ? window.location.origin : "");
  const portalUrl = `${resolvedOrigin}/?portal=bailleur`;
  const landlordDisplayName = landlord.companyName ? `${landlord.companyName} (${landlord.fullName})` : landlord.fullName;
  const messageText = [
    `*ACC\xC8S PORTAIL BAILLEUR \u2014 ${agencyName.toUpperCase()}*`,
    ``,
    `Bonjour *${landlordDisplayName}*,`,
    `Votre compte propri\xE9taire est activ\xE9 pour suivre vos biens immobiliers en temps r\xE9el.`,
    ``,
    `\u{1F517} *Lien de connexion Portail Bailleur* :`,
    `${portalUrl}`,
    ``,
    `\u{1F464} *Compte (Identifiant)* : ${portalUsername}`,
    `\u{1F511} *Mot de passe* : ${portalPassword}`,
    ``,
    `Depuis votre portail s\xE9curis\xE9, vous pouvez consulter \xE0 tout moment :`,
    `\u2022 L'\xE9tat d'occupation et la localisation GPS de vos biens`,
    `\u2022 Vos contrats de bail PDF et locataires en place`,
    `\u2022 Vos loyers encaiss\xE9s, quittances PDF et reversements nets`,
    ``,
    `Cordialement,`,
    `*${agencyName}*`
  ].join("\n");
  const whatsappUrl = sanitizedDigits ? `https://wa.me/${sanitizedDigits}?text=${encodeURIComponent(messageText)}` : "";
  return {
    landlordId: landlord.id,
    landlordDisplayName,
    portalUsername,
    portalPassword,
    portalUrl,
    whatsappPhoneDisplay,
    sanitizedDigits,
    isCompliant: Boolean(sanitizedDigits.length >= 8),
    validationError: waValidation.isValid ? void 0 : waValidation.error,
    messageText,
    whatsappUrl
  };
}

// src/db/gimmo-repository.ts
async function getAllDashboardData() {
  try {
    const sb = requireSupabaseAdmin();
    const [landlordsRes, propertiesRes, tenantsRes, leasesRes, paymentsRes] = await Promise.all([
      sb.from("landlords").select("*").order("id", { ascending: false }),
      sb.from("properties").select("*").order("id", { ascending: false }),
      sb.from("tenants").select("*").order("id", { ascending: false }),
      sb.from("leases").select("*").order("id", { ascending: false }),
      sb.from("payments").select("*").order("id", { ascending: false })
    ]);
    if (landlordsRes.error) throw landlordsRes.error;
    if (propertiesRes.error) throw propertiesRes.error;
    if (tenantsRes.error) throw tenantsRes.error;
    if (leasesRes.error) throw leasesRes.error;
    if (paymentsRes.error) throw paymentsRes.error;
    return {
      landlords: (landlordsRes.data || []).map(mapLandlordRow),
      properties: (propertiesRes.data || []).map(mapPropertyRow),
      tenants: (tenantsRes.data || []).map(mapTenantRow),
      leases: (leasesRes.data || []).map(mapLeaseRow),
      payments: (paymentsRes.data || []).map(mapPaymentRow)
    };
  } catch (error) {
    console.error("Supabase query failed in getAllDashboardData:", error);
    throw new Error("Failed to fetch Gimmo data from Supabase.", {
      cause: error
    });
  }
}
async function getPaymentFullDetailsByToken(shareToken) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: paymentRow, error } = await sb.from("payments").select("*").eq("share_token", shareToken).maybeSingle();
    if (error) throw error;
    if (!paymentRow) return null;
    const payment = mapPaymentRow(paymentRow);
    const [landlordRes, propertyRes, tenantRes, leaseRes] = await Promise.all([
      sb.from("landlords").select("*").eq("id", payment.landlordId).maybeSingle(),
      sb.from("properties").select("*").eq("id", payment.propertyId).maybeSingle(),
      sb.from("tenants").select("*").eq("id", payment.tenantId).maybeSingle(),
      sb.from("leases").select("*").eq("id", payment.leaseId).maybeSingle()
    ]);
    if (!landlordRes.data || !propertyRes.data || !tenantRes.data || !leaseRes.data) {
      return null;
    }
    return {
      payment,
      landlord: mapLandlordRow(landlordRes.data),
      property: mapPropertyRow(propertyRes.data),
      tenant: mapTenantRow(tenantRes.data),
      lease: mapLeaseRow(leaseRes.data)
    };
  } catch (error) {
    console.error("Supabase query failed in getPaymentFullDetailsByToken:", error);
    throw new Error("Failed to load receipt details.", { cause: error });
  }
}
async function getPaymentFullDetailsById(paymentId) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: paymentRow, error } = await sb.from("payments").select("*").eq("id", paymentId).maybeSingle();
    if (error) throw error;
    if (!paymentRow) return null;
    const payment = mapPaymentRow(paymentRow);
    const [landlordRes, propertyRes, tenantRes, leaseRes] = await Promise.all([
      sb.from("landlords").select("*").eq("id", payment.landlordId).maybeSingle(),
      sb.from("properties").select("*").eq("id", payment.propertyId).maybeSingle(),
      sb.from("tenants").select("*").eq("id", payment.tenantId).maybeSingle(),
      sb.from("leases").select("*").eq("id", payment.leaseId).maybeSingle()
    ]);
    if (!landlordRes.data || !propertyRes.data || !tenantRes.data || !leaseRes.data) {
      return null;
    }
    return {
      payment,
      landlord: mapLandlordRow(landlordRes.data),
      property: mapPropertyRow(propertyRes.data),
      tenant: mapTenantRow(tenantRes.data),
      lease: mapLeaseRow(leaseRes.data)
    };
  } catch (error) {
    console.error("Supabase query failed in getPaymentFullDetailsById:", error);
    throw new Error("Failed to load payment details.", { cause: error });
  }
}
async function getLeaseFullDetailsByToken(shareToken) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: leaseRow, error } = await sb.from("leases").select("*").eq("share_token", shareToken).maybeSingle();
    if (error) throw error;
    if (!leaseRow) return null;
    const lease = mapLeaseRow(leaseRow);
    const [landlordRes, propertyRes, tenantRes] = await Promise.all([
      sb.from("landlords").select("*").eq("id", lease.landlordId).maybeSingle(),
      sb.from("properties").select("*").eq("id", lease.propertyId).maybeSingle(),
      sb.from("tenants").select("*").eq("id", lease.tenantId).maybeSingle()
    ]);
    if (!landlordRes.data || !propertyRes.data || !tenantRes.data) {
      return null;
    }
    return {
      lease,
      landlord: mapLandlordRow(landlordRes.data),
      property: mapPropertyRow(propertyRes.data),
      tenant: mapTenantRow(tenantRes.data)
    };
  } catch (error) {
    console.error("Supabase query failed in getLeaseFullDetailsByToken:", error);
    throw new Error("Failed to load lease contract details.", { cause: error });
  }
}
async function getLeaseFullDetailsById(leaseId) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: leaseRow, error } = await sb.from("leases").select("*").eq("id", leaseId).maybeSingle();
    if (error) throw error;
    if (!leaseRow) return null;
    const lease = mapLeaseRow(leaseRow);
    const [landlordRes, propertyRes, tenantRes] = await Promise.all([
      sb.from("landlords").select("*").eq("id", lease.landlordId).maybeSingle(),
      sb.from("properties").select("*").eq("id", lease.propertyId).maybeSingle(),
      sb.from("tenants").select("*").eq("id", lease.tenantId).maybeSingle()
    ]);
    if (!landlordRes.data || !propertyRes.data || !tenantRes.data) {
      return null;
    }
    return {
      lease,
      landlord: mapLandlordRow(landlordRes.data),
      property: mapPropertyRow(propertyRes.data),
      tenant: mapTenantRow(tenantRes.data)
    };
  } catch (error) {
    console.error("Supabase query failed in getLeaseFullDetailsById:", error);
    throw new Error("Failed to load lease details.", { cause: error });
  }
}
async function markPaymentAsPaid(paymentId, paymentMethod = "Mobile Money") {
  try {
    const sb = requireSupabaseAdmin();
    const { data: existing, error: fetchErr } = await sb.from("payments").select("*").eq("id", paymentId).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) {
      throw new Error("Payment record not found");
    }
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const { data: updated, error: updateErr } = await sb.from("payments").update({
      amount_paid: existing.amount_due,
      payment_date: today,
      payment_method: paymentMethod,
      status: "paid",
      days_late: 0
    }).eq("id", paymentId).select("*").single();
    if (updateErr) throw updateErr;
    return mapPaymentRow(updated);
  } catch (error) {
    console.error("Supabase query failed in markPaymentAsPaid:", error);
    throw new Error("Failed to record payment.", { cause: error });
  }
}
async function markWhatsappSent(paymentId) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: updated, error } = await sb.from("payments").update({ whatsapp_sent: true }).eq("id", paymentId).select("*").single();
    if (error) throw error;
    return mapPaymentRow(updated);
  } catch (error) {
    console.error("Supabase query failed in markWhatsappSent:", error);
    throw new Error("Failed to update WhatsApp status.", { cause: error });
  }
}
async function createPropertyRecord(data) {
  try {
    const sb = requireSupabaseAdmin();
    const postgisWkt = `SRID=4326;POINT(${data.longitude} ${data.latitude})`;
    const { data: inserted, error } = await sb.from("properties").insert({
      user_id: data.userId,
      landlord_id: data.landlordId,
      reference: data.reference,
      title: data.title,
      property_type: data.propertyType,
      address: data.address,
      city: data.city,
      neighborhood: data.neighborhood,
      surface_area: Number(data.surfaceArea),
      rooms_count: Number(data.roomsCount),
      monthly_rent: Number(data.monthlyRent),
      charges_amount: Number(data.chargesAmount || 0),
      currency: "FCFA",
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      postgis_wkt: postgisWkt,
      status: data.status || "vacant"
    }).select("*").single();
    if (error) throw error;
    return mapPropertyRow(inserted);
  } catch (error) {
    console.error("Supabase query failed in createPropertyRecord:", error);
    throw new Error("Failed to create property.", { cause: error });
  }
}
async function createLandlordRecord(data) {
  try {
    const sb = requireSupabaseAdmin();
    const portalUsername = (data.portalUsername || "").trim() || deriveDefaultLandlordUsername({
      email: data.email,
      phone: data.phone,
      fullName: data.fullName
    });
    const portalPassword = (data.portalPassword || "").trim() || generateLandlordPortalPassword();
    const portalEnabled = data.portalEnabled !== false;
    const { data: inserted, error } = await sb.from("landlords").insert({
      user_id: data.userId,
      full_name: data.fullName,
      company_name: data.companyName || null,
      email: data.email,
      phone: data.phone,
      address: data.address,
      tax_id: data.taxId || null,
      iban: data.iban || null,
      commission_rate: Number(data.commissionRate ?? 8),
      contract_header_note: data.contractHeaderNote || null,
      portal_username: portalUsername,
      portal_password: portalPassword,
      portal_enabled: portalEnabled
    }).select("*").single();
    if (error) throw error;
    return mapLandlordRow(inserted);
  } catch (error) {
    console.error("Supabase query failed in createLandlordRecord:", error);
    throw new Error("Failed to create landlord.", { cause: error });
  }
}
async function createTenantAndLeaseRecord(data) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: propRow, error: propErr } = await sb.from("properties").select("*").eq("id", data.propertyId).maybeSingle();
    if (propErr) throw propErr;
    if (!propRow) throw new Error("Bien introuvable");
    const property = mapPropertyRow(propRow);
    const { data: insertedTenantRow, error: tenantErr } = await sb.from("tenants").insert({
      user_id: data.userId,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone_whatsapp: data.phoneWhatsapp,
      national_id_number: data.nationalIdNumber,
      profession: data.profession || "Cadre",
      monthly_income: Number(data.monthlyIncome || 15e5),
      dossier_status: "approved"
    }).select("*").single();
    if (tenantErr) throw tenantErr;
    const tenant = mapTenantRow(insertedTenantRow);
    const randSuffix = Math.floor(1e3 + Math.random() * 9e3);
    const contractNumber = `BAIL-2026-${randSuffix}`;
    const shareToken = `tok-lease-${Date.now()}-${randSuffix}`;
    const rentNum = Number(property.monthlyRent);
    const chargesNum = Number(property.chargesAmount);
    const totalDue = rentNum + chargesNum;
    const { data: insertedLeaseRow, error: leaseErr } = await sb.from("leases").insert({
      user_id: data.userId,
      contract_number: contractNumber,
      landlord_id: property.landlordId,
      property_id: property.id,
      tenant_id: tenant.id,
      start_date: data.startDate,
      end_date: data.endDate,
      rent_amount: rentNum,
      charges_amount: chargesNum,
      security_deposit: rentNum * 2,
      payment_due_day: 5,
      custom_clauses: data.customClauses || "Le preneur s\u2019engage \xE0 r\xE9gler le loyer au plus tard le 5 de chaque mois.",
      status: "active",
      share_token: shareToken
    }).select("*").single();
    if (leaseErr) throw leaseErr;
    const lease = mapLeaseRow(insertedLeaseRow);
    await sb.from("properties").update({ status: "occupied" }).eq("id", property.id);
    const { error: payErr } = await sb.from("payments").insert({
      user_id: data.userId,
      receipt_number: `QUIT-202611-${randSuffix}`,
      lease_id: lease.id,
      landlord_id: property.landlordId,
      property_id: property.id,
      tenant_id: tenant.id,
      period_month: "2026-11",
      period_label: "Novembre 2026",
      amount_due: totalDue,
      amount_paid: totalDue,
      due_date: "2026-11-05",
      payment_date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      payment_method: "Mobile Money",
      status: "paid",
      days_late: 0,
      whatsapp_sent: false,
      share_token: `tok-quit-${Date.now()}-${randSuffix}`
    });
    if (payErr) throw payErr;
    return { tenant, lease };
  } catch (error) {
    console.error("Supabase query failed in createTenantAndLeaseRecord:", error);
    throw new Error("Failed to create tenant and lease.", { cause: error });
  }
}
async function updatePropertyRecord(propertyId, data) {
  try {
    const sb = requireSupabaseAdmin();
    const postgisWkt = `SRID=4326;POINT(${data.longitude} ${data.latitude})`;
    const { data: updated, error } = await sb.from("properties").update({
      landlord_id: data.landlordId,
      reference: data.reference,
      title: data.title,
      property_type: data.propertyType,
      address: data.address,
      city: data.city,
      neighborhood: data.neighborhood,
      surface_area: Number(data.surfaceArea),
      rooms_count: Number(data.roomsCount),
      monthly_rent: Number(data.monthlyRent),
      charges_amount: Number(data.chargesAmount || 0),
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      postgis_wkt: postgisWkt,
      status: data.status
    }).eq("id", propertyId).select("*").maybeSingle();
    if (error) throw error;
    if (!updated) {
      throw new Error("Bien immobilier introuvable");
    }
    return mapPropertyRow(updated);
  } catch (error) {
    console.error("Supabase query failed in updatePropertyRecord:", error);
    throw new Error("Impossible de modifier le bien immobilier.", {
      cause: error
    });
  }
}
async function updateLandlordRecord(landlordId, data) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: currentRow, error: findErr } = await sb.from("landlords").select("*").eq("id", landlordId).maybeSingle();
    if (findErr) throw findErr;
    if (!currentRow) {
      if (data.fullName && data.fullName.trim()) {
        return await createLandlordRecord({
          userId: "global_demo",
          ...data
        });
      }
      throw new Error("Bailleur introuvable");
    }
    const existing = mapLandlordRow(currentRow);
    const resolvedUsername = data.portalUsername !== void 0 && data.portalUsername.trim() !== "" ? data.portalUsername.trim() : existing.portalUsername || deriveDefaultLandlordUsername({
      email: data.email,
      phone: data.phone,
      fullName: data.fullName
    });
    const resolvedPassword = data.portalPassword !== void 0 && data.portalPassword.trim() !== "" ? data.portalPassword.trim() : existing.portalPassword || generateLandlordPortalPassword();
    const resolvedEnabled = data.portalEnabled !== void 0 ? Boolean(data.portalEnabled) : existing.portalEnabled ?? true;
    const { data: updated, error: updateErr } = await sb.from("landlords").update({
      full_name: data.fullName,
      company_name: data.companyName || null,
      email: data.email,
      phone: data.phone,
      address: data.address,
      tax_id: data.taxId || null,
      iban: data.iban || null,
      commission_rate: Number(data.commissionRate ?? 8),
      contract_header_note: data.contractHeaderNote || null,
      portal_username: resolvedUsername,
      portal_password: resolvedPassword,
      portal_enabled: resolvedEnabled
    }).eq("id", landlordId).select("*").single();
    if (updateErr) throw updateErr;
    return mapLandlordRow(updated);
  } catch (error) {
    console.error("Supabase query failed in updateLandlordRecord:", error);
    throw new Error("Impossible de modifier le bailleur.", { cause: error });
  }
}
async function updateTenantAndLeaseRecord(leaseId, data) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: leaseRow, error: leaseFindErr } = await sb.from("leases").select("*").eq("id", leaseId).maybeSingle();
    if (leaseFindErr) throw leaseFindErr;
    if (!leaseRow) throw new Error("Contrat de bail introuvable");
    const currentLease = mapLeaseRow(leaseRow);
    const { data: propRow, error: propFindErr } = await sb.from("properties").select("*").eq("id", data.propertyId).maybeSingle();
    if (propFindErr) throw propFindErr;
    if (!propRow) throw new Error("Bien immobilier introuvable");
    const property = mapPropertyRow(propRow);
    const { data: updatedTenant, error: tenantErr } = await sb.from("tenants").update({
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone_whatsapp: data.phoneWhatsapp,
      national_id_number: data.nationalIdNumber,
      profession: data.profession || null,
      employer: data.employer || null,
      guarantor_name: data.guarantorName || null,
      guarantor_phone: data.guarantorPhone || null
    }).eq("id", currentLease.tenantId).select("*").single();
    if (tenantErr) throw tenantErr;
    const { data: updatedLease, error: leaseUpdErr } = await sb.from("leases").update({
      landlord_id: property.landlordId,
      property_id: property.id,
      start_date: data.startDate,
      end_date: data.endDate,
      rent_amount: Number(data.rentAmount),
      charges_amount: Number(data.chargesAmount || 0),
      security_deposit: Number(data.securityDeposit),
      payment_due_day: Number(data.paymentDueDay),
      custom_clauses: data.customClauses || null,
      status: data.status
    }).eq("id", leaseId).select("*").single();
    if (leaseUpdErr) throw leaseUpdErr;
    return {
      tenant: mapTenantRow(updatedTenant),
      lease: mapLeaseRow(updatedLease)
    };
  } catch (error) {
    console.error("Supabase query failed in updateTenantAndLeaseRecord:", error);
    throw new Error("Impossible de modifier le dossier locataire et bail.", {
      cause: error
    });
  }
}
async function updatePaymentRecord(paymentId, data) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: updated, error } = await sb.from("payments").update({
      period_label: data.periodLabel,
      amount_due: Number(data.amountDue),
      amount_paid: Number(data.amountPaid || 0),
      due_date: data.dueDate,
      payment_date: data.paymentDate || null,
      payment_method: data.paymentMethod || null,
      status: data.status,
      days_late: Number(data.daysLate || 0)
    }).eq("id", paymentId).select("*").maybeSingle();
    if (error) throw error;
    if (!updated) {
      throw new Error("Quittance introuvable");
    }
    return mapPaymentRow(updated);
  } catch (error) {
    console.error("Supabase query failed in updatePaymentRecord:", error);
    throw new Error("Impossible de modifier la quittance.", { cause: error });
  }
}
async function createPaymentRecord(data) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: leaseRow, error: leaseErr } = await sb.from("leases").select("*").eq("id", data.leaseId).maybeSingle();
    if (leaseErr) throw leaseErr;
    if (!leaseRow) {
      throw new Error("Contrat de bail introuvable pour cette quittance");
    }
    const lease = mapLeaseRow(leaseRow);
    const randSuffix = Math.floor(1e3 + Math.random() * 9e3);
    const cleanPeriod = (data.periodMonth || "2026-11").replace("-", "");
    const receiptNumber = `QUIT-${cleanPeriod}-${randSuffix}`;
    const shareToken = `tok-quit-${Date.now()}-${randSuffix}`;
    const { data: inserted, error: insertErr } = await sb.from("payments").insert({
      user_id: data.userId,
      receipt_number: receiptNumber,
      lease_id: lease.id,
      landlord_id: lease.landlordId,
      property_id: lease.propertyId,
      tenant_id: lease.tenantId,
      period_month: data.periodMonth || "2026-11",
      period_label: data.periodLabel,
      amount_due: Number(data.amountDue),
      amount_paid: Number(data.amountPaid || 0),
      due_date: data.dueDate,
      payment_date: data.paymentDate || null,
      payment_method: data.paymentMethod || null,
      status: data.status,
      days_late: Number(data.daysLate || 0),
      whatsapp_sent: false,
      share_token: shareToken
    }).select("*").single();
    if (insertErr) throw insertErr;
    return mapPaymentRow(inserted);
  } catch (error) {
    console.error("Supabase query failed in createPaymentRecord:", error);
    throw new Error("Impossible de cr\xE9er la quittance.", { cause: error });
  }
}
async function generateRentCallsForMonthRecord(data) {
  try {
    const sb = requireSupabaseAdmin();
    const [leasesRes, paymentsRes] = await Promise.all([
      sb.from("leases").select("*"),
      sb.from("payments").select("*").eq("period_month", data.periodMonth)
    ]);
    if (leasesRes.error) throw leasesRes.error;
    if (paymentsRes.error) throw paymentsRes.error;
    const allLeases = (leasesRes.data || []).map(mapLeaseRow);
    const existingPayments = (paymentsRes.data || []).map(mapPaymentRow);
    const activeLeases = allLeases.filter((l) => l.status === "active");
    const existingLeaseIds = new Set(existingPayments.map((p) => p.leaseId));
    const missingLeases = activeLeases.filter(
      (l) => !existingLeaseIds.has(l.id)
    );
    if (missingLeases.length === 0) {
      return [];
    }
    const cleanPeriod = (data.periodMonth || "2026-12").replace("-", "");
    const dayStr = String(data.defaultDueDay || 5).padStart(2, "0");
    const dueDate = `${data.periodMonth}-${dayStr}`;
    const status = data.initialStatus || "pending";
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const valuesToInsert = missingLeases.map((lease, idx) => {
      const randSuffix = Math.floor(1e3 + Math.random() * 9e3) + idx;
      const totalDue = Number(lease.rentAmount || 0) + Number(lease.chargesAmount || 0);
      return {
        user_id: data.userId,
        receipt_number: `QUIT-${cleanPeriod}-${randSuffix}`,
        lease_id: lease.id,
        landlord_id: lease.landlordId,
        property_id: lease.propertyId,
        tenant_id: lease.tenantId,
        period_month: data.periodMonth,
        period_label: data.periodLabel,
        amount_due: totalDue,
        amount_paid: status === "paid" ? totalDue : 0,
        due_date: dueDate,
        payment_date: status === "paid" ? todayStr : null,
        payment_method: status === "paid" ? "Mobile Money" : null,
        status,
        days_late: 0,
        whatsapp_sent: false,
        share_token: `tok-quit-${Date.now()}-${randSuffix}`
      };
    });
    const { data: inserted, error: insertErr } = await sb.from("payments").insert(valuesToInsert).select("*");
    if (insertErr) throw insertErr;
    return (inserted || []).map(mapPaymentRow);
  } catch (error) {
    console.error(
      "Supabase query failed in generateRentCallsForMonthRecord:",
      error
    );
    throw new Error("Impossible de g\xE9n\xE9rer les appels de loyer du mois.", {
      cause: error
    });
  }
}
async function deletePaymentRecord(paymentId) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: deleted, error } = await sb.from("payments").delete().eq("id", paymentId).select("*").maybeSingle();
    if (error) throw error;
    return deleted ? mapPaymentRow(deleted) : null;
  } catch (error) {
    console.error("Supabase query failed in deletePaymentRecord:", error);
    throw new Error("Impossible de supprimer la quittance.", { cause: error });
  }
}
async function deleteLeaseRecord(leaseId) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: targetRow } = await sb.from("leases").select("*").eq("id", leaseId).maybeSingle();
    const targetLease = targetRow ? mapLeaseRow(targetRow) : null;
    await sb.from("payments").delete().eq("lease_id", leaseId);
    const { data: deleted, error } = await sb.from("leases").delete().eq("id", leaseId).select("*").maybeSingle();
    if (error) throw error;
    if (targetLease) {
      const { data: remainingForProp } = await sb.from("leases").select("id").eq("property_id", targetLease.propertyId);
      if (!remainingForProp || remainingForProp.length === 0) {
        await sb.from("properties").update({ status: "vacant" }).eq("id", targetLease.propertyId);
      }
      const { data: remainingForTenant } = await sb.from("leases").select("id").eq("tenant_id", targetLease.tenantId);
      if (!remainingForTenant || remainingForTenant.length === 0) {
        await sb.from("tenants").delete().eq("id", targetLease.tenantId);
      }
    }
    return deleted ? mapLeaseRow(deleted) : null;
  } catch (error) {
    console.error("Supabase query failed in deleteLeaseRecord:", error);
    throw new Error("Impossible de supprimer le contrat de bail.", {
      cause: error
    });
  }
}
async function deletePropertyRecord(propertyId) {
  try {
    const sb = requireSupabaseAdmin();
    await sb.from("payments").delete().eq("property_id", propertyId);
    await sb.from("leases").delete().eq("property_id", propertyId);
    const { data: deleted, error } = await sb.from("properties").delete().eq("id", propertyId).select("*").maybeSingle();
    if (error) throw error;
    return deleted ? mapPropertyRow(deleted) : null;
  } catch (error) {
    console.error("Supabase query failed in deletePropertyRecord:", error);
    throw new Error("Impossible de supprimer le bien immobilier.", {
      cause: error
    });
  }
}
async function deleteLandlordRecord(landlordId) {
  try {
    const sb = requireSupabaseAdmin();
    await sb.from("payments").delete().eq("landlord_id", landlordId);
    await sb.from("leases").delete().eq("landlord_id", landlordId);
    await sb.from("properties").delete().eq("landlord_id", landlordId);
    const { data: deleted, error } = await sb.from("landlords").delete().eq("id", landlordId).select("*").maybeSingle();
    if (error) throw error;
    return deleted ? mapLandlordRow(deleted) : null;
  } catch (error) {
    console.error("Supabase query failed in deleteLandlordRecord:", error);
    throw new Error("Impossible de supprimer le bailleur.", { cause: error });
  }
}
async function renamePropertyTypeInRecords(oldTypeName, newTypeName) {
  try {
    if (!oldTypeName || !newTypeName || oldTypeName === newTypeName) {
      return [];
    }
    const sb = requireSupabaseAdmin();
    const { data: updated, error } = await sb.from("properties").update({ property_type: newTypeName }).eq("property_type", oldTypeName).select("*");
    if (error) throw error;
    return (updated || []).map(mapPropertyRow);
  } catch (error) {
    console.error(
      "Supabase query failed in renamePropertyTypeInRecords:",
      error
    );
    throw new Error(
      "Impossible de renommer le type de bien sur les lots existants.",
      { cause: error }
    );
  }
}
async function upsertLandlordPortalCredentialsRecord(landlordId, options) {
  const sb = requireSupabaseAdmin();
  const { data: existingRow, error: fetchErr } = await sb.from("landlords").select("*").eq("id", landlordId).maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!existingRow) {
    throw new Error("Bailleur introuvable.");
  }
  const existing = mapLandlordRow(existingRow);
  const nextUsername = options.portalUsername && options.portalUsername.trim() ? options.portalUsername.trim() : existing.portalUsername || deriveDefaultLandlordUsername({
    email: existing.email,
    phone: existing.phone,
    fullName: existing.fullName
  });
  const nextPassword = options.regeneratePassword ? generateLandlordPortalPassword() : options.portalPassword && options.portalPassword.trim() ? options.portalPassword.trim() : existing.portalPassword || generateLandlordPortalPassword();
  const nextEnabled = options.portalEnabled !== void 0 ? Boolean(options.portalEnabled) : existing.portalEnabled ?? true;
  const { data: updated, error: updateErr } = await sb.from("landlords").update({
    portal_username: nextUsername,
    portal_password: nextPassword,
    portal_enabled: nextEnabled
  }).eq("id", landlordId).select("*").single();
  if (updateErr) throw updateErr;
  return mapLandlordRow(updated);
}
async function authenticateLandlordPortalRecord(identifier, password, explicitLandlordId) {
  const cleanId = (identifier || "").trim().toLowerCase();
  const idDigits = (identifier || "").replace(/\D+/g, "");
  const cleanPass = (password || "").trim();
  if (!cleanId && !explicitLandlordId || !cleanPass) {
    throw new Error(
      "Veuillez saisir votre compte (identifiant, email ou t\xE9l\xE9phone) et votre mot de passe."
    );
  }
  const sb = requireSupabaseAdmin();
  const query = explicitLandlordId ? sb.from("landlords").select("*").eq("id", explicitLandlordId) : sb.from("landlords").select("*");
  const { data: rows, error: listErr } = await query;
  if (listErr) throw listErr;
  const allLandlords = (rows || []).map(mapLandlordRow);
  const candidates = allLandlords.filter((l) => {
    if (explicitLandlordId && l.id === explicitLandlordId) {
      return true;
    }
    const uName = (l.portalUsername || "").trim().toLowerCase();
    const uMail = (l.email || "").trim().toLowerCase();
    const lDigits = (l.phone || "").replace(/\D+/g, "");
    const phoneMatch = idDigits.length >= 8 && lDigits.length >= 8 && (lDigits === idDigits || lDigits.endsWith(idDigits) || idDigits.endsWith(lDigits));
    return uName && uName === cleanId || uMail && uMail === cleanId || phoneMatch;
  });
  if (candidates.length === 0) {
    throw new Error(
      "Aucun compte bailleur trouv\xE9 pour cet identifiant. V\xE9rifiez les acc\xE8s re\xE7us par WhatsApp."
    );
  }
  const enabledCandidates = candidates.filter((c) => c.portalEnabled !== false);
  if (enabledCandidates.length === 0) {
    throw new Error(
      "L\u2019acc\xE8s au Portail Bailleur pour ce compte est actuellement d\xE9sactiv\xE9 par votre agence."
    );
  }
  const withPasswordCandidates = enabledCandidates.filter(
    (c) => Boolean((c.portalPassword || "").trim())
  );
  if (withPasswordCandidates.length === 0) {
    throw new Error(
      "Aucun mot de passe portail n\u2019a encore \xE9t\xE9 activ\xE9 pour ce compte. Demandez vos acc\xE8s WhatsApp \xE0 votre agence."
    );
  }
  const matched = withPasswordCandidates.find((c) => {
    const storedPass = (c.portalPassword || "").trim();
    const isGeneratedCode = storedPass.toUpperCase().startsWith("GIM-");
    return isGeneratedCode ? storedPass.toUpperCase() === cleanPass.toUpperCase() : storedPass === cleanPass;
  });
  if (!matched) {
    throw new Error(
      "Mot de passe incorrect. Veuillez v\xE9rifier le code re\xE7u sur WhatsApp."
    );
  }
  const [updatedRes, propsRes, leasesRes, paysRes] = await Promise.all([
    sb.from("landlords").update({ portal_last_login_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", matched.id).select("*").maybeSingle(),
    sb.from("properties").select("*").eq("landlord_id", matched.id).order("id", { ascending: false }),
    sb.from("leases").select("*").eq("landlord_id", matched.id).order("id", { ascending: false }),
    sb.from("payments").select("*").eq("landlord_id", matched.id).order("id", { ascending: false })
  ]);
  const landlordProperties = (propsRes.data || []).map(mapPropertyRow);
  const landlordLeases = (leasesRes.data || []).map(mapLeaseRow);
  const landlordPayments = (paysRes.data || []).map(mapPaymentRow);
  const tenantIds = Array.from(
    /* @__PURE__ */ new Set([
      ...landlordLeases.map((l) => l.tenantId),
      ...landlordPayments.map((p) => p.tenantId)
    ])
  );
  let landlordTenants = [];
  if (tenantIds.length > 0) {
    const { data: tRows } = await sb.from("tenants").select("*").in("id", tenantIds);
    landlordTenants = (tRows || []).map(mapTenantRow);
  }
  return {
    landlord: updatedRes.data ? mapLandlordRow(updatedRes.data) : matched,
    properties: landlordProperties,
    leases: landlordLeases,
    tenants: landlordTenants,
    payments: landlordPayments
  };
}

// src/lib/rbac.ts
function normalizeUserRole(raw) {
  if (!raw) return "administrateur";
  const lower = raw.toLowerCase().trim();
  if (lower === "gerant" || lower === "g\xE9rant" || lower === "manager") {
    return "gerant";
  }
  if (lower === "commercial" || lower === "sales" || lower === "agent") {
    return "commercial";
  }
  return "administrateur";
}

// src/db/users.ts
function mapRowToAppUser(row) {
  return {
    id: Number(row.id),
    uid: String(row.uid || ""),
    email: String(row.email || ""),
    name: row.name || String(row.email || "").split("@")[0],
    role: normalizeUserRole(row.role),
    createdAt: row.created_at ? String(row.created_at) : (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function getAllUsers() {
  try {
    const sb = requireSupabaseAdmin();
    const { data, error } = await sb.from("users").select("*").order("id", { ascending: true });
    if (error) throw error;
    return (data || []).map(mapRowToAppUser);
  } catch (error) {
    console.error("Supabase query failed in getAllUsers:", error);
    return [];
  }
}
async function getOrCreateUser(uid, email, name, requestedRole) {
  try {
    const sb = requireSupabaseAdmin();
    const cleanEmail = email.trim().toLowerCase();
    const { data: byEmail, error: emailErr } = await sb.from("users").select("*").eq("email", cleanEmail).limit(1);
    if (emailErr) throw emailErr;
    if (byEmail && byEmail.length > 0) {
      const existingUser = byEmail[0];
      const nextRole = requestedRole ? normalizeUserRole(requestedRole) : normalizeUserRole(existingUser.role);
      const { data: updated, error: updateErr } = await sb.from("users").update({
        name: name || existingUser.name || cleanEmail.split("@")[0],
        role: nextRole
      }).eq("id", existingUser.id).select("*").single();
      if (updateErr) throw updateErr;
      return mapRowToAppUser(updated);
    }
    const defaultRole = requestedRole ? normalizeUserRole(requestedRole) : "administrateur";
    const { data: upserted, error: upsertErr } = await sb.from("users").upsert(
      {
        uid,
        email: cleanEmail,
        name: name || cleanEmail.split("@")[0],
        role: defaultRole
      },
      { onConflict: "uid" }
    ).select("*").single();
    if (upsertErr) throw upsertErr;
    return mapRowToAppUser(upserted);
  } catch (error) {
    console.error("Supabase query failed in getOrCreateUser:", error);
    throw new Error("Failed to synchronize user profile.", { cause: error });
  }
}
async function upsertUserRecord(data) {
  try {
    const sb = requireSupabaseAdmin();
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanName = data.name.trim() || cleanEmail.split("@")[0];
    const cleanRole = normalizeUserRole(data.role);
    if (data.id) {
      const { data: updated, error } = await sb.from("users").update({
        email: cleanEmail,
        name: cleanName,
        role: cleanRole
      }).eq("id", Number(data.id)).select("*").maybeSingle();
      if (error) throw error;
      if (updated) {
        return mapRowToAppUser(updated);
      }
    }
    const { data: existingByEmail, error: findErr } = await sb.from("users").select("*").eq("email", cleanEmail).limit(1);
    if (findErr) throw findErr;
    if (existingByEmail && existingByEmail.length > 0) {
      const { data: updated, error: updateErr } = await sb.from("users").update({
        name: cleanName,
        role: cleanRole
      }).eq("id", existingByEmail[0].id).select("*").single();
      if (updateErr) throw updateErr;
      return mapRowToAppUser(updated);
    }
    const generatedUid = `gimmo-${cleanRole}-${Date.now()}`;
    const { data: inserted, error: insertErr } = await sb.from("users").insert({
      uid: generatedUid,
      email: cleanEmail,
      name: cleanName,
      role: cleanRole
    }).select("*").single();
    if (insertErr) throw insertErr;
    return mapRowToAppUser(inserted);
  } catch (error) {
    console.error("Supabase query failed in upsertUserRecord:", error);
    throw new Error("Impossible d'enregistrer le compte utilisateur.", {
      cause: error
    });
  }
}

// src/lib/firebase-admin.ts
import fs from "fs";
import path from "path";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
function resolveFirebaseProjectId() {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID.trim();
  }
  if (process.env.GOOGLE_CLOUD_PROJECT) {
    return process.env.GOOGLE_CLOUD_PROJECT.trim();
  }
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (parsed?.projectId) {
        return String(parsed.projectId);
      }
    }
  } catch {
  }
  return void 0;
}
function getAdminAuth() {
  if (!getApps().length) {
    const projectId = resolveFirebaseProjectId();
    initializeApp(projectId ? { projectId } : void 0);
  }
  return getAuth();
}

// src/middleware/auth.ts
var requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying Firebase ID token:", error);
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

// src/services/pdf-generator.ts
import PDFDocument from "pdfkit";
import fs2 from "fs";
import path2 from "path";
var SAAS_SETTINGS_ROW_ID = "gimmo_saas_store";
var TEMPLATES_FILE_PATH = path2.resolve(
  process.env.VERCEL ? "/tmp" : process.cwd(),
  ".gimmo-document-templates.json"
);
var memoryTemplatesStore = null;
function normalizeLoadedStore(parsed) {
  if (!parsed.accountingMonths || parsed.accountingMonths.length === 0) {
    parsed.accountingMonths = [...DEFAULT_ACCOUNTING_MONTHS];
  }
  if (!parsed.propertyTypes || parsed.propertyTypes.length === 0) {
    parsed.propertyTypes = [...DEFAULT_PROPERTY_TYPES];
  }
  if (!parsed.managementCompany || !parsed.managementCompany.companyName) {
    parsed.managementCompany = { ...DEFAULT_MANAGEMENT_COMPANY };
  }
  if (!parsed.saasTenants || parsed.saasTenants.length === 0) {
    parsed.saasTenants = [...DEFAULT_SAAS_TENANTS];
  }
  if (!parsed.saasUsers || parsed.saasUsers.length === 0) {
    parsed.saasUsers = [...DEFAULT_SAAS_USERS];
  }
  return parsed;
}
async function initTemplatesStoreFromDb() {
  try {
    const supabaseJson = await loadAppSettingsFromSupabase(SAAS_SETTINGS_ROW_ID);
    if (supabaseJson) {
      const parsed = JSON.parse(supabaseJson);
      if (parsed && parsed.leases && parsed.receipts) {
        memoryTemplatesStore = normalizeLoadedStore(parsed);
        return memoryTemplatesStore;
      }
    }
  } catch (err) {
    console.warn("Could not load SaaS store from Supabase app_settings:", err);
  }
  return getDocumentTemplatesStore();
}
async function persistTemplatesStore(next) {
  memoryTemplatesStore = next;
  const serialized = JSON.stringify(next, null, 2);
  try {
    fs2.writeFileSync(TEMPLATES_FILE_PATH, serialized, "utf-8");
  } catch (err) {
    console.warn("Could not persist .gimmo-document-templates.json:", err);
  }
  try {
    await saveAppSettingsToSupabase(SAAS_SETTINGS_ROW_ID, serialized);
  } catch (err) {
    console.warn("Could not persist SaaS store to Supabase app_settings:", err);
  }
  return next;
}
function getDocumentTemplatesStore() {
  if (memoryTemplatesStore) {
    return memoryTemplatesStore;
  }
  try {
    if (fs2.existsSync(TEMPLATES_FILE_PATH)) {
      const raw = fs2.readFileSync(TEMPLATES_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && parsed.leases && parsed.receipts) {
        memoryTemplatesStore = normalizeLoadedStore(parsed);
        return memoryTemplatesStore;
      }
    }
  } catch (err) {
    console.warn("Could not read .gimmo-document-templates.json:", err);
  }
  memoryTemplatesStore = createInitialTemplatesStore();
  return memoryTemplatesStore;
}
async function saveDocumentTemplateEntry(payload) {
  const current = await initTemplatesStoreFromDb();
  const next = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: resolveAccountingMonths(current),
    propertyTypes: resolvePropertyTypes(current),
    managementCompany: resolveManagementCompany(current),
    saasTenants: resolveSaaSTenants(current),
    saasUsers: resolveSaaSUsers(current),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (payload.kind === "lease") {
    next.leases[payload.scopeKey] = payload.config;
  } else {
    next.receipts[payload.scopeKey] = payload.config;
  }
  return await persistTemplatesStore(next);
}
async function saveManagementCompanyEntry(payload) {
  const current = await initTemplatesStoreFromDb();
  const existing = resolveManagementCompany(current);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const updatedProfile = {
    ...existing,
    companyName: (payload.companyName ?? existing.companyName).trim(),
    tradeName: (payload.tradeName ?? existing.tradeName).trim(),
    legalForm: (payload.legalForm ?? existing.legalForm).trim(),
    rccm: (payload.rccm ?? existing.rccm).trim(),
    taxId: (payload.taxId ?? existing.taxId).trim(),
    licenseNumber: (payload.licenseNumber ?? existing.licenseNumber).trim(),
    managerName: (payload.managerName ?? existing.managerName).trim(),
    managerTitle: (payload.managerTitle ?? existing.managerTitle).trim(),
    address: (payload.address ?? existing.address).trim(),
    city: (payload.city ?? existing.city).trim(),
    phone: (payload.phone ?? existing.phone).trim(),
    email: (payload.email ?? existing.email).trim(),
    website: (payload.website ?? existing.website).trim(),
    bankInfo: (payload.bankInfo ?? existing.bankInfo).trim(),
    headerSlogan: (payload.headerSlogan ?? existing.headerSlogan).trim(),
    updatedAt: nowIso
  };
  const currentTenants = resolveSaaSTenants(current).map(
    (t) => t.isCurrentTenant ? {
      ...t,
      companyName: updatedProfile.companyName,
      tradeName: updatedProfile.tradeName,
      legalForm: updatedProfile.legalForm,
      rccm: updatedProfile.rccm,
      taxId: updatedProfile.taxId,
      licenseNumber: updatedProfile.licenseNumber,
      managerName: updatedProfile.managerName,
      phone: updatedProfile.phone,
      address: updatedProfile.address,
      city: updatedProfile.city
    } : t
  );
  const next = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: resolveAccountingMonths(current),
    propertyTypes: resolvePropertyTypes(current),
    managementCompany: updatedProfile,
    saasTenants: currentTenants,
    saasUsers: resolveSaaSUsers(current),
    updatedAt: nowIso
  };
  return await persistTemplatesStore(next);
}
async function upsertSaaSTenantEntry(payload) {
  const current = await initTemplatesStoreFromDb();
  const existingList = resolveSaaSTenants(current);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const normalizedName = payload.companyName.trim().toLowerCase();
  const targetId = payload.id || "";
  const existingIdx = existingList.findIndex(
    (t) => targetId && t.id === targetId || t.companyName.trim().toLowerCase() === normalizedName
  );
  if (payload.activateOnly) {
    if (existingIdx < 0) {
      return current;
    }
    const targetTenant = existingList[existingIdx];
    const updatedOnlyActive = existingList.map((item, idx) => ({
      ...item,
      isCurrentTenant: idx === existingIdx
    }));
    const currentMgmt = resolveManagementCompany(current);
    const nextStore = {
      leases: { ...current.leases },
      receipts: { ...current.receipts },
      accountingMonths: resolveAccountingMonths(current),
      propertyTypes: resolvePropertyTypes(current),
      managementCompany: {
        ...currentMgmt,
        companyName: targetTenant.companyName,
        tradeName: targetTenant.tradeName,
        legalForm: targetTenant.legalForm,
        rccm: targetTenant.rccm,
        taxId: targetTenant.taxId,
        licenseNumber: targetTenant.licenseNumber,
        managerName: targetTenant.managerName,
        address: targetTenant.address,
        city: targetTenant.city,
        phone: targetTenant.phone,
        email: targetTenant.ownerEmail,
        updatedAt: nowIso
      },
      saasTenants: updatedOnlyActive,
      saasUsers: resolveSaaSUsers(current),
      updatedAt: nowIso
    };
    return await persistTemplatesStore(nextStore);
  }
  const duplicateOther = existingList.find(
    (t, idx) => idx !== existingIdx && t.companyName.trim().toLowerCase() === normalizedName
  );
  if (duplicateOther) {
    throw new Error(
      `Le nom d'agence \xAB ${payload.companyName.trim()} \xBB existe d\xE9j\xE0. Le nom de l'agence immobili\xE8re est une cl\xE9 unique.`
    );
  }
  const makeCurrent = Boolean(payload.isCurrentTenant);
  let updatedList;
  if (existingIdx >= 0) {
    updatedList = existingList.map((item, idx) => {
      if (idx !== existingIdx) {
        return makeCurrent ? { ...item, isCurrentTenant: false } : item;
      }
      const currentStoredPhone = (item.whatsappPhone || item.phone || "").trim();
      const incomingRawPhone = (payload.whatsappPhone ?? payload.phone ?? currentStoredPhone).trim();
      const phoneWasChanged = (payload.whatsappPhone !== void 0 || payload.phone !== void 0) && incomingRawPhone !== currentStoredPhone;
      const waCheck = validateWhatsAppPhone(incomingRawPhone);
      if (phoneWasChanged && !waCheck.isValid) {
        throw new Error(
          waCheck.error || "Le num\xE9ro WhatsApp saisi pour l\u2019agence immobili\xE8re n\u2019est pas conforme."
        );
      }
      const normalizedPhone = waCheck.isValid ? waCheck.formattedDisplay : incomingRawPhone;
      return {
        ...item,
        companyName: payload.companyName.trim(),
        tradeName: (payload.tradeName ?? item.tradeName).trim(),
        legalForm: (payload.legalForm ?? item.legalForm).trim(),
        rccm: (payload.rccm ?? item.rccm).trim(),
        taxId: (payload.taxId ?? item.taxId).trim(),
        licenseNumber: (payload.licenseNumber ?? item.licenseNumber).trim(),
        managerName: (payload.managerName ?? item.managerName).trim(),
        ownerEmail: (payload.ownerEmail ?? item.ownerEmail).trim(),
        phone: normalizedPhone,
        whatsappPhone: normalizedPhone,
        address: (payload.address ?? item.address).trim(),
        city: (payload.city ?? item.city).trim(),
        plan: payload.plan || item.plan,
        status: payload.status || item.status,
        monthlyFeeFcfa: Number(payload.monthlyFeeFcfa ?? item.monthlyFeeFcfa ?? 75e3),
        maxProperties: Number(payload.maxProperties ?? item.maxProperties ?? 100),
        maxLandlords: Number(payload.maxLandlords ?? item.maxLandlords ?? 25),
        subscriptionEndsAt: payload.subscriptionEndsAt || item.subscriptionEndsAt,
        isCurrentTenant: makeCurrent ? true : item.isCurrentTenant
      };
    });
  } else {
    const rawCandidatePhone = (payload.whatsappPhone || payload.phone || "").trim();
    const waCheck = validateWhatsAppPhone(rawCandidatePhone);
    if (!waCheck.isValid) {
      throw new Error(
        waCheck.error || "Le num\xE9ro WhatsApp saisi pour l\u2019agence immobili\xE8re n\u2019est pas conforme."
      );
    }
    const resolvedPhone = waCheck.formattedDisplay;
    const newItem = {
      id: targetId || `tenant_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      companyName: payload.companyName.trim(),
      tradeName: (payload.tradeName || payload.companyName).trim(),
      legalForm: (payload.legalForm || "SARL au capital de 5 000 000 FCFA").trim(),
      rccm: (payload.rccm || "CI-ABJ-03-2026-B12-00100").trim(),
      taxId: (payload.taxId || "CC 2600100 A").trim(),
      licenseNumber: (payload.licenseNumber || "Agr\xE9ment MCLU N\xB0 2026/AG").trim(),
      managerName: (payload.managerName || "G\xE9rant Mandataire").trim(),
      ownerEmail: (payload.ownerEmail || "direction@agence.ci").trim(),
      phone: resolvedPhone,
      whatsappPhone: resolvedPhone,
      address: (payload.address || "Abidjan Cocody").trim(),
      city: (payload.city || "Abidjan").trim(),
      plan: payload.plan || "pro",
      status: payload.status || "pending_approval",
      monthlyFeeFcfa: Number(payload.monthlyFeeFcfa ?? 75e3),
      maxProperties: Number(payload.maxProperties ?? 150),
      maxLandlords: Number(payload.maxLandlords ?? 35),
      subscriptionEndsAt: payload.subscriptionEndsAt || "2027-12-31",
      isCurrentTenant: makeCurrent,
      createdAt: nowIso
    };
    updatedList = [
      ...makeCurrent ? existingList.map((t) => ({ ...t, isCurrentTenant: false })) : existingList,
      newItem
    ];
  }
  let nextManagementCompany = resolveManagementCompany(current);
  const activeTenant = updatedList.find((t) => t.isCurrentTenant);
  if (makeCurrent && activeTenant) {
    nextManagementCompany = {
      ...nextManagementCompany,
      companyName: activeTenant.companyName,
      tradeName: activeTenant.tradeName,
      legalForm: activeTenant.legalForm,
      rccm: activeTenant.rccm,
      taxId: activeTenant.taxId,
      licenseNumber: activeTenant.licenseNumber,
      managerName: activeTenant.managerName,
      address: activeTenant.address,
      city: activeTenant.city,
      phone: activeTenant.phone,
      email: activeTenant.ownerEmail,
      updatedAt: nowIso
    };
  }
  let nextUsers = resolveSaaSUsers(current);
  const savedTenant = updatedList.find(
    (t) => targetId && t.id === targetId || t.companyName.trim().toLowerCase() === normalizedName
  );
  const ownerMail = (savedTenant?.ownerEmail || "").trim().toLowerCase();
  if (savedTenant && ownerMail && ownerMail.includes("@") && ownerMail !== "direction@agence.ci" && !nextUsers.some((u) => u.email.trim().toLowerCase() === ownerMail)) {
    nextUsers = [
      ...nextUsers,
      {
        id: `user_owner_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        fullName: savedTenant.managerName || ownerMail.split("@")[0],
        email: ownerMail,
        whatsappPhone: savedTenant.whatsappPhone || savedTenant.phone,
        role: ownerMail === "assamoighislain@gmail.com" ? "super_admin" : "agency_admin",
        tenantId: savedTenant.id,
        tenantName: savedTenant.companyName,
        status: "active",
        createdAt: nowIso
      }
    ];
  }
  const next = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: resolveAccountingMonths(current),
    propertyTypes: resolvePropertyTypes(current),
    managementCompany: nextManagementCompany,
    saasTenants: updatedList,
    saasUsers: nextUsers,
    updatedAt: nowIso
  };
  return await persistTemplatesStore(next);
}
async function deleteSaaSTenantEntry(id) {
  const current = await initTemplatesStoreFromDb();
  const existingList = resolveSaaSTenants(current);
  const existingUsers = resolveSaaSUsers(current);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  let updatedList = existingList.filter((item) => item.id !== id);
  if (updatedList.length === 0) {
    updatedList = [...DEFAULT_SAAS_TENANTS];
  } else if (!updatedList.some((t) => t.isCurrentTenant)) {
    updatedList[0] = { ...updatedList[0], isCurrentTenant: true };
  }
  const fallbackTenant = updatedList.find((t) => t.isCurrentTenant) || updatedList[0];
  const updatedUsers = existingUsers.filter(
    (u) => u.tenantId !== id || u.role === "super_admin" || u.email.trim().toLowerCase() === "assamoighislain@gmail.com"
  ).map(
    (u) => u.tenantId === id ? {
      ...u,
      tenantId: fallbackTenant.id,
      tenantName: fallbackTenant.companyName
    } : u
  );
  const next = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: resolveAccountingMonths(current),
    propertyTypes: resolvePropertyTypes(current),
    managementCompany: resolveManagementCompany(current),
    saasTenants: updatedList,
    saasUsers: updatedUsers,
    updatedAt: nowIso
  };
  return await persistTemplatesStore(next);
}
async function upsertSaaSUserEntry(payload) {
  const current = await initTemplatesStoreFromDb();
  const existingList = resolveSaaSUsers(current);
  const tenants = resolveSaaSTenants(current);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const normalizedTargetEmail = payload.email.trim().toLowerCase();
  const isMainSuperAdmin = normalizedTargetEmail === "assamoighislain@gmail.com";
  const targetId = payload.id || "";
  const existingIdx = existingList.findIndex(
    (u) => targetId && u.id === targetId || u.email.trim().toLowerCase() === normalizedTargetEmail
  );
  const existingUser = existingIdx >= 0 ? existingList[existingIdx] : null;
  if (payload.isLoginSync) {
    if (!existingUser && !isMainSuperAdmin) {
      throw new Error(
        "Acc\xE8s refus\xE9 : Aucun compte utilisateur existant. Seul l\u2019Administrateur ou le Directeur de l\u2019Agence peut cr\xE9er un compte et lui affecter un r\xF4le."
      );
    }
  } else if (payload.isInitialAgencyRegistration) {
    if (existingUser && !isMainSuperAdmin) {
      throw new Error(
        `Un compte utilisateur existe d\xE9j\xE0 avec l\u2019adresse email \xAB ${payload.email.trim()} \xBB. Veuillez vous connecter ou utiliser une autre adresse email.`
      );
    }
  } else {
    const normalizedActorEmail = (payload.actorEmail || "").trim().toLowerCase();
    const actorRecord = normalizedActorEmail ? existingList.find(
      (u) => u.email.trim().toLowerCase() === normalizedActorEmail
    ) : void 0;
    const effectiveActorRole = normalizedActorEmail === "assamoighislain@gmail.com" ? "super_admin" : actorRecord?.role || payload.actorRole;
    const effectiveActorTenantId = actorRecord?.tenantId || payload.actorTenantId || "";
    if (effectiveActorRole !== "super_admin" && effectiveActorRole !== "agency_admin") {
      throw new Error(
        "Acc\xE8s refus\xE9 : Seul l\u2019Administrateur ou le Directeur de l\u2019Agence peut cr\xE9er les comptes des autres utilisateurs et affecter des r\xF4les."
      );
    }
    if (effectiveActorRole === "agency_admin") {
      if (isMainSuperAdmin || existingUser?.role === "super_admin") {
        throw new Error(
          "Acc\xE8s refus\xE9 : Un Directeur d\u2019Agence ne peut pas modifier un compte Administrateur."
        );
      }
      if (payload.role === "super_admin") {
        throw new Error(
          "Acc\xE8s refus\xE9 : Un Directeur d\u2019Agence ne peut affecter que les r\xF4les Directeur d\u2019Agence, Gestionnaire Locatif ou Agent Immobilier."
        );
      }
      if (existingUser && effectiveActorTenantId && existingUser.tenantId !== effectiveActorTenantId) {
        throw new Error(
          "Acc\xE8s refus\xE9 : Vous ne pouvez g\xE9rer que les utilisateurs rattach\xE9s \xE0 votre propre agence."
        );
      }
      if (payload.tenantId && effectiveActorTenantId && payload.tenantId !== effectiveActorTenantId) {
        throw new Error(
          "Acc\xE8s refus\xE9 : Vous ne pouvez rattacher des comptes qu\u2019\xE0 votre propre agence."
        );
      }
    }
  }
  const matchedTenant = tenants.find((t) => t.id === payload.tenantId) || (existingUser ? tenants.find((t) => t.id === existingUser.tenantId) : void 0) || tenants.find((t) => t.isCurrentTenant) || tenants[0];
  const resolvedRole = isMainSuperAdmin ? "super_admin" : payload.isInitialAgencyRegistration ? "agency_admin" : payload.isLoginSync && existingUser ? existingUser.role : payload.role || existingUser?.role || "agent";
  let updatedList;
  if (existingIdx >= 0 && existingUser) {
    updatedList = existingList.map((item, idx) => {
      if (idx !== existingIdx) return item;
      const nextPassword = payload.password !== void 0 && String(payload.password).trim() !== "" ? String(payload.password).trim() : item.password;
      return {
        ...item,
        fullName: payload.fullName.trim() || item.fullName,
        email: payload.email.trim(),
        password: nextPassword,
        whatsappPhone: payload.whatsappPhone ?? item.whatsappPhone,
        role: resolvedRole,
        tenantId: payload.isLoginSync ? item.tenantId : matchedTenant?.id || item.tenantId,
        tenantName: payload.isLoginSync ? item.tenantName : matchedTenant?.companyName || item.tenantName,
        status: payload.isLoginSync ? item.status : payload.status || item.status,
        createdByEmail: payload.createdByEmail || item.createdByEmail,
        lastLoginAt: payload.isLoginSync ? nowIso : item.lastLoginAt
      };
    });
  } else {
    const newItem = {
      id: targetId || `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fullName: payload.fullName.trim(),
      email: payload.email.trim(),
      password: payload.password !== void 0 && String(payload.password).trim() !== "" ? String(payload.password).trim() : void 0,
      whatsappPhone: payload.whatsappPhone,
      role: resolvedRole,
      tenantId: matchedTenant?.id || "tenant_gimmo_prestige",
      tenantName: matchedTenant?.companyName || "GIMMO PRESTIGE IMMOBILIER SARL",
      status: payload.status || "active",
      createdByEmail: payload.createdByEmail || payload.actorEmail,
      lastLoginAt: payload.isInitialAgencyRegistration ? nowIso : void 0,
      createdAt: nowIso
    };
    updatedList = [...existingList, newItem];
  }
  const next = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: resolveAccountingMonths(current),
    propertyTypes: resolvePropertyTypes(current),
    managementCompany: resolveManagementCompany(current),
    saasTenants: tenants,
    saasUsers: updatedList,
    updatedAt: nowIso
  };
  const savedStore = await persistTemplatesStore(next);
  const mappedDbRole = resolvedRole === "super_admin" || resolvedRole === "agency_admin" ? "administrateur" : resolvedRole === "manager" ? "gerant" : "commercial";
  upsertUserRecord({
    email: payload.email.trim().toLowerCase(),
    name: payload.fullName.trim(),
    role: mappedDbRole
  }).catch((err) => {
    console.warn("Best-effort sync to public.users failed:", err?.message || err);
  });
  return savedStore;
}
async function authenticateSaaSUserEntry(email, password) {
  const stripInvisible = (value) => String(value || "").replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ").trim();
  const rawIdentifier = stripInvisible(email);
  const normalizedEmail = rawIdentifier.toLowerCase();
  const identifierDigits = rawIdentifier.replace(/\D+/g, "");
  const typedPassword = stripInvisible(password);
  if (!normalizedEmail) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_INPUT",
      error: "Veuillez saisir votre adresse email professionnelle ou num\xE9ro WhatsApp."
    };
  }
  const current = await initTemplatesStoreFromDb();
  const tenants = resolveSaaSTenants(current);
  const users = resolveSaaSUsers(current);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const isMainSuperAdmin = normalizedEmail === "assamoighislain@gmail.com";
  const matchesPhone = (phone) => {
    if (identifierDigits.length < 8 || !phone) return false;
    const targetDigits = phone.replace(/\D+/g, "");
    if (targetDigits.length < 8) return false;
    return targetDigits === identifierDigits || targetDigits.endsWith(identifierDigits) || identifierDigits.endsWith(targetDigits);
  };
  let foundUser = isMainSuperAdmin ? users.find(
    (u) => u.email.trim().toLowerCase() === normalizedEmail && u.role === "super_admin"
  ) || users.find((u) => u.email.trim().toLowerCase() === normalizedEmail) : [...users].reverse().find((u) => u.email.trim().toLowerCase() === normalizedEmail) || (identifierDigits.length >= 8 ? [...users].reverse().find((u) => matchesPhone(u.whatsappPhone)) : void 0);
  if (!foundUser && !isMainSuperAdmin) {
    const matchedOwnerTenant = tenants.find(
      (t) => t.ownerEmail && t.ownerEmail.trim().toLowerCase() === normalizedEmail || matchesPhone(t.whatsappPhone || t.phone)
    );
    if (matchedOwnerTenant) {
      foundUser = {
        id: `user_owner_${matchedOwnerTenant.id}`,
        fullName: matchedOwnerTenant.managerName || matchedOwnerTenant.ownerEmail.split("@")[0],
        email: matchedOwnerTenant.ownerEmail.trim().toLowerCase(),
        whatsappPhone: matchedOwnerTenant.whatsappPhone || matchedOwnerTenant.phone,
        role: "agency_admin",
        tenantId: matchedOwnerTenant.id,
        tenantName: matchedOwnerTenant.companyName,
        status: "active",
        createdAt: matchedOwnerTenant.createdAt || nowIso
      };
    }
  }
  if (!foundUser && !isMainSuperAdmin && normalizedEmail.includes("@")) {
    const dbUsers = await getAllUsers().catch(() => []);
    const matchedDbUser = dbUsers.find(
      (u) => u.email.trim().toLowerCase() === normalizedEmail
    );
    if (matchedDbUser) {
      const defaultAgency = tenants.find((t) => t.isCurrentTenant && t.status === "active") || tenants.find((t) => t.status === "active") || tenants[0];
      const mappedRole = matchedDbUser.role === "administrateur" ? "agency_admin" : matchedDbUser.role === "gerant" ? "manager" : "agent";
      foundUser = {
        id: `user_db_${matchedDbUser.id}`,
        fullName: matchedDbUser.name || normalizedEmail.split("@")[0],
        email: normalizedEmail,
        role: mappedRole,
        tenantId: defaultAgency?.id || "tenant_gimmo_prestige",
        tenantName: defaultAgency?.companyName || "GIMMO PRESTIGE IMMOBILIER SARL",
        status: "active",
        createdAt: matchedDbUser.createdAt || nowIso
      };
    }
  }
  if (!foundUser && !isMainSuperAdmin && normalizedEmail.includes("@") && typedPassword) {
    const sbAuthUser = await verifySupabaseAuthPassword(
      normalizedEmail,
      typedPassword
    );
    if (sbAuthUser) {
      const defaultAgency = tenants.find((t) => t.isCurrentTenant && t.status === "active") || tenants.find((t) => t.status === "active") || tenants[0];
      foundUser = {
        id: `user_sb_${sbAuthUser.id}`,
        fullName: sbAuthUser.fullName,
        email: sbAuthUser.email,
        password: typedPassword,
        role: "agent",
        tenantId: defaultAgency?.id || "tenant_gimmo_prestige",
        tenantName: defaultAgency?.companyName || "GIMMO PRESTIGE IMMOBILIER SARL",
        status: "active",
        createdAt: nowIso
      };
    }
  }
  if (!foundUser && isMainSuperAdmin) {
    const chosenAgency = tenants.find((t) => t.isCurrentTenant) || tenants[0];
    foundUser = {
      id: "user_super_admin_main",
      fullName: "Ghislain Assamoi",
      email: normalizedEmail,
      role: "super_admin",
      tenantId: chosenAgency?.id || "tenant_gimmo_prestige",
      tenantName: chosenAgency?.companyName || "GIMMO PRESTIGE IMMOBILIER SARL",
      status: "active",
      createdAt: nowIso.split("T")[0]
    };
  }
  if (!foundUser) {
    return {
      ok: false,
      status: 404,
      code: "USER_NOT_FOUND",
      error: "Aucun compte trouv\xE9 pour cet identifiant. Seul l\u2019Administrateur ou le Directeur de l\u2019Agence peut cr\xE9er les comptes des autres utilisateurs et leur affecter un r\xF4le. Pour enregistrer une nouvelle agence immobili\xE8re, utilisez l\u2019onglet \xAB Cr\xE9er une agence \xBB."
    };
  }
  const effectiveEmail = foundUser.email.trim().toLowerCase();
  const isSuperAdmin = isMainSuperAdmin || effectiveEmail === "assamoighislain@gmail.com" || foundUser.role === "super_admin";
  if (!isSuperAdmin && foundUser.status === "suspended") {
    return {
      ok: false,
      status: 403,
      code: "USER_SUSPENDED",
      error: "Ce compte utilisateur est suspendu par l\u2019Administrateur ou le Directeur d\u2019Agence."
    };
  }
  const storedPassword = stripInvisible(foundUser.password || "");
  if (storedPassword) {
    if (!typedPassword) {
      return {
        ok: false,
        status: 401,
        code: "PASSWORD_REQUIRED",
        error: "Veuillez saisir votre mot de passe."
      };
    }
    const isPasswordMatch = typedPassword === storedPassword || storedPassword.toUpperCase().startsWith("GIM-") && typedPassword.toUpperCase() === storedPassword.toUpperCase();
    if (!isPasswordMatch) {
      return {
        ok: false,
        status: 401,
        code: "INVALID_PASSWORD",
        error: "Mot de passe incorrect pour ce compte utilisateur."
      };
    }
  }
  const linkedAgency = tenants.find((t) => t.id === foundUser.tenantId) || tenants.find(
    (t) => t.companyName.trim().toLowerCase() === foundUser.tenantName.trim().toLowerCase()
  ) || tenants.find((t) => t.isCurrentTenant) || tenants[0];
  if (!isSuperAdmin && linkedAgency?.status === "pending_approval") {
    return {
      ok: false,
      status: 403,
      code: "PENDING_APPROVAL",
      error: `L\u2019agence immobili\xE8re \xAB ${linkedAgency.companyName} \xBB est actuellement en attente d\u2019approbation. Seul le Super Admin (assamoighislain@gmail.com) a le droit d\u2019approuver une agence immobili\xE8re.`
    };
  }
  if (!isSuperAdmin && linkedAgency?.status === "suspended") {
    return {
      ok: false,
      status: 403,
      code: "AGENCY_SUSPENDED",
      error: `L\u2019agence immobili\xE8re \xAB ${linkedAgency.companyName} \xBB est suspendue par le Super Admin.`
    };
  }
  const authenticatedUser = {
    ...foundUser,
    role: isMainSuperAdmin ? "super_admin" : foundUser.role,
    tenantId: linkedAgency?.id || foundUser.tenantId,
    tenantName: linkedAgency?.companyName || foundUser.tenantName,
    lastLoginAt: nowIso
  };
  const existingUserIdx = users.findIndex(
    (u) => u.id === authenticatedUser.id || u.email.trim().toLowerCase() === effectiveEmail
  );
  const updatedUsers = existingUserIdx >= 0 ? users.map(
    (u, idx) => idx === existingUserIdx ? { ...u, ...authenticatedUser } : u
  ) : [...users, authenticatedUser];
  const updatedTenants = linkedAgency ? tenants.map((t) => ({
    ...t,
    isCurrentTenant: t.id === linkedAgency.id
  })) : tenants;
  let nextManagementCompany = resolveManagementCompany(current);
  const activeTenant = updatedTenants.find((t) => t.isCurrentTenant);
  if (activeTenant) {
    nextManagementCompany = {
      ...nextManagementCompany,
      companyName: activeTenant.companyName,
      tradeName: activeTenant.tradeName,
      legalForm: activeTenant.legalForm,
      rccm: activeTenant.rccm,
      taxId: activeTenant.taxId,
      licenseNumber: activeTenant.licenseNumber,
      managerName: activeTenant.managerName,
      address: activeTenant.address,
      city: activeTenant.city,
      phone: activeTenant.phone,
      email: activeTenant.ownerEmail,
      updatedAt: nowIso
    };
  }
  const nextStore = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: resolveAccountingMonths(current),
    propertyTypes: resolvePropertyTypes(current),
    managementCompany: nextManagementCompany,
    saasTenants: updatedTenants,
    saasUsers: updatedUsers,
    updatedAt: nowIso
  };
  const persisted = await persistTemplatesStore(nextStore);
  return {
    ok: true,
    status: 200,
    user: authenticatedUser,
    agency: activeTenant || linkedAgency,
    templates: persisted
  };
}
async function deleteSaaSUserEntry(id, actor) {
  const current = await initTemplatesStoreFromDb();
  const existingList = resolveSaaSUsers(current);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const targetUser = existingList.find((u) => u.id === id);
  if (targetUser && targetUser.email.trim().toLowerCase() === "assamoighislain@gmail.com") {
    throw new Error(
      "Le compte Administrateur principal est prot\xE9g\xE9 et ne peut pas \xEAtre supprim\xE9."
    );
  }
  if (actor) {
    const normalizedActorEmail = (actor.actorEmail || "").trim().toLowerCase();
    const actorRecord = normalizedActorEmail ? existingList.find(
      (u) => u.email.trim().toLowerCase() === normalizedActorEmail
    ) : void 0;
    const effectiveRole = normalizedActorEmail === "assamoighislain@gmail.com" ? "super_admin" : actorRecord?.role || actor.actorRole;
    const effectiveTenantId = actorRecord?.tenantId || actor.actorTenantId || "";
    if (effectiveRole !== "super_admin" && effectiveRole !== "agency_admin") {
      throw new Error(
        "Acc\xE8s refus\xE9 : Seul l\u2019Administrateur ou le Directeur de l\u2019Agence peut supprimer un compte utilisateur."
      );
    }
    if (effectiveRole === "agency_admin" && targetUser) {
      if (targetUser.role === "super_admin") {
        throw new Error(
          "Acc\xE8s refus\xE9 : Impossible de supprimer un compte Administrateur."
        );
      }
      if (effectiveTenantId && targetUser.tenantId !== effectiveTenantId) {
        throw new Error(
          "Acc\xE8s refus\xE9 : Vous ne pouvez supprimer que les comptes de votre propre agence."
        );
      }
    }
  }
  const updatedList = existingList.filter(
    (u) => u.id !== id || u.email.toLowerCase() === "assamoighislain@gmail.com" && u.role === "super_admin"
  );
  const next = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: resolveAccountingMonths(current),
    propertyTypes: resolvePropertyTypes(current),
    managementCompany: resolveManagementCompany(current),
    saasTenants: resolveSaaSTenants(current),
    saasUsers: updatedList.length > 0 ? updatedList : [...DEFAULT_SAAS_USERS],
    updatedAt: nowIso
  };
  return await persistTemplatesStore(next);
}
async function upsertAccountingMonthEntry(payload) {
  const current = await initTemplatesStoreFromDb();
  const existingList = resolveAccountingMonths(current);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const existingIdx = existingList.findIndex(
    (m) => m.periodMonth === payload.periodMonth
  );
  let updatedList;
  if (existingIdx >= 0) {
    updatedList = existingList.map((m, idx) => {
      const isTarget = idx === existingIdx;
      const nextIsCurrent = payload.isCurrent !== void 0 ? isTarget ? Boolean(payload.isCurrent) : payload.isCurrent ? false : m.isCurrent : m.isCurrent;
      if (!isTarget) {
        return { ...m, isCurrent: nextIsCurrent };
      }
      return {
        ...m,
        periodLabel: payload.periodLabel || m.periodLabel,
        defaultDueDay: Number(payload.defaultDueDay ?? m.defaultDueDay ?? 5),
        status: payload.status || m.status,
        isCurrent: nextIsCurrent
      };
    });
  } else {
    const makeCurrent = Boolean(payload.isCurrent);
    const newEntry = {
      periodMonth: payload.periodMonth,
      periodLabel: payload.periodLabel,
      defaultDueDay: Number(payload.defaultDueDay || 5),
      status: payload.status || "open",
      isCurrent: makeCurrent,
      createdAt: nowIso
    };
    updatedList = [
      newEntry,
      ...existingList.map((m) => ({
        ...m,
        isCurrent: makeCurrent ? false : m.isCurrent
      }))
    ].sort((a, b) => b.periodMonth.localeCompare(a.periodMonth));
  }
  const next = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: updatedList,
    propertyTypes: resolvePropertyTypes(current),
    managementCompany: resolveManagementCompany(current),
    saasTenants: resolveSaaSTenants(current),
    saasUsers: resolveSaaSUsers(current),
    updatedAt: nowIso
  };
  return await persistTemplatesStore(next);
}
async function deleteAccountingMonthEntry(periodMonth) {
  const current = await initTemplatesStoreFromDb();
  const existingList = resolveAccountingMonths(current);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  let updatedList = existingList.filter((m) => m.periodMonth !== periodMonth);
  if (updatedList.length > 0 && !updatedList.some((m) => m.isCurrent)) {
    updatedList[0] = { ...updatedList[0], isCurrent: true };
  }
  const next = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: updatedList,
    propertyTypes: resolvePropertyTypes(current),
    managementCompany: resolveManagementCompany(current),
    saasTenants: resolveSaaSTenants(current),
    saasUsers: resolveSaaSUsers(current),
    updatedAt: nowIso
  };
  return await persistTemplatesStore(next);
}
async function upsertPropertyTypeEntry(payload) {
  const current = await initTemplatesStoreFromDb();
  const existingList = resolvePropertyTypes(current);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const targetId = payload.id || "";
  const existingIdx = existingList.findIndex(
    (item) => targetId && item.id === targetId || !targetId && item.name.toLowerCase() === payload.name.trim().toLowerCase()
  );
  let updatedList;
  if (existingIdx >= 0) {
    updatedList = existingList.map((item, idx) => {
      if (idx !== existingIdx) return item;
      return {
        ...item,
        name: payload.name.trim(),
        code: (payload.code || item.code || payload.name.slice(0, 4)).toUpperCase(),
        category: payload.category || item.category || "habitation",
        defaultCharges: String(payload.defaultCharges ?? item.defaultCharges ?? "0"),
        description: payload.description ?? item.description ?? ""
      };
    });
  } else {
    const newItem = {
      id: targetId || `type_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: payload.name.trim(),
      code: (payload.code || payload.name.slice(0, 4)).toUpperCase(),
      category: payload.category || "habitation",
      defaultCharges: String(payload.defaultCharges || "35000"),
      description: payload.description || "Type de bien immobilier configur\xE9 dans le param\xE9trage Gimmo",
      createdAt: nowIso
    };
    updatedList = [...existingList, newItem];
  }
  const next = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: resolveAccountingMonths(current),
    propertyTypes: updatedList,
    managementCompany: resolveManagementCompany(current),
    saasTenants: resolveSaaSTenants(current),
    saasUsers: resolveSaaSUsers(current),
    updatedAt: nowIso
  };
  return await persistTemplatesStore(next);
}
async function deletePropertyTypeEntry(id) {
  const current = await initTemplatesStoreFromDb();
  const existingList = resolvePropertyTypes(current);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const updatedList = existingList.filter((item) => item.id !== id);
  const next = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: resolveAccountingMonths(current),
    propertyTypes: updatedList.length > 0 ? updatedList : [...DEFAULT_PROPERTY_TYPES],
    managementCompany: resolveManagementCompany(current),
    saasTenants: resolveSaaSTenants(current),
    saasUsers: resolveSaaSUsers(current),
    updatedAt: nowIso
  };
  return await persistTemplatesStore(next);
}
function formatCurrency(amount, currency = "FCFA") {
  const num = Number(amount) || 0;
  return `${num.toLocaleString("fr-FR")} ${currency}`;
}
function buildDocumentVariables(details) {
  const { landlord, property, tenant, lease, payment } = details;
  const store = getDocumentTemplatesStore();
  const company = details.managementCompany || resolveManagementCompany(store);
  const currency = property?.currency || "FCFA";
  const rentVal = Number(lease?.rentAmount || property?.monthlyRent || 0);
  const chargesVal = Number(lease?.chargesAmount || property?.chargesAmount || 0);
  const totalMensuel = rentVal + chargesVal;
  const totalDueVal = Number(payment?.amountDue || totalMensuel);
  const paidVal = Number(payment?.amountPaid || 0);
  const balanceVal = Math.max(0, totalDueVal - paidVal);
  return {
    nom_societe_gestion: company.companyName,
    enseigne_societe_gestion: company.tradeName || company.companyName,
    forme_juridique_societe_gestion: company.legalForm,
    rccm_societe_gestion: company.rccm,
    id_fiscal_societe_gestion: company.taxId,
    agrement_societe_gestion: company.licenseNumber,
    gerant_societe_gestion: `${company.managerName} (${company.managerTitle})`,
    adresse_societe_gestion: `${company.address}, ${company.city}`,
    telephone_societe_gestion: company.phone,
    email_societe_gestion: company.email,
    site_societe_gestion: company.website,
    banque_societe_gestion: company.bankInfo,
    nom_bailleur: landlord?.companyName ? `${landlord.companyName} (repr\xE9sent\xE9e par ${landlord.fullName})` : landlord?.fullName || "Bailleur",
    id_fiscal_bailleur: landlord?.taxId || "N/A",
    adresse_bailleur: landlord?.address || "",
    telephone_bailleur: landlord?.phone || "",
    email_bailleur: landlord?.email || "",
    note_bailleur: landlord?.contractHeaderNote || "Le Preneur s\u2019engage \xE0 jouir des lieux en bon p\xE8re de famille et \xE0 souscrire une police d\u2019assurance multirisque.",
    nom_locataire: tenant ? `${tenant.firstName} ${tenant.lastName}` : "Locataire",
    cni_locataire: tenant?.nationalIdNumber || "N/A",
    whatsapp_locataire: tenant?.phoneWhatsapp || "",
    email_locataire: tenant?.email || "",
    profession_locataire: tenant?.profession || "Non renseign\xE9e",
    employeur_locataire: tenant?.employer || "Ind\xE9pendant",
    titre_bien: property?.title || "",
    reference_bien: property?.reference || "",
    type_bien: property?.propertyType || "",
    adresse_bien: property?.address || "",
    quartier_bien: property?.neighborhood || "",
    ville_bien: property?.city || "Abidjan",
    surface_bien: String(property?.surfaceArea || 0),
    pieces_bien: String(property?.roomsCount || 1),
    numero_contrat: lease?.contractNumber || "BAIL-2026",
    loyer_mensuel: formatCurrency(rentVal, currency),
    charges: formatCurrency(chargesVal, currency),
    total_mensuel: formatCurrency(totalMensuel, currency),
    caution: formatCurrency(lease?.securityDeposit || rentVal * 2, currency),
    date_debut: lease?.startDate || "",
    date_fin: lease?.endDate || "Reconduction tacite annuelle",
    jour_echeance: String(lease?.paymentDueDay || 5),
    clauses_contrat: lease?.customClauses || "Aucune clause particuli\xE8re suppl\xE9mentaire.",
    numero_quittance: payment?.receiptNumber || "QUIT-2026",
    periode: payment?.periodLabel || "Novembre 2026",
    montant_appele: formatCurrency(totalDueVal, currency),
    montant_paye: formatCurrency(paidVal, currency),
    reste_a_payer: formatCurrency(balanceVal, currency),
    mode_paiement: payment?.paymentMethod || "En attente",
    date_paiement: payment?.paymentDate || "Non sold\xE9",
    jeton_partage: payment?.shareToken || lease?.shareToken || ""
  };
}
function drawManagementCompanyPdfBanner(doc, company, accentColor, topY = 34) {
  doc.font("Helvetica-Bold").fontSize(11).fillColor(accentColor).text(company.companyName.toUpperCase(), 50, topY, { width: 495 });
  doc.font("Helvetica").fontSize(8).fillColor("#475569").text(
    `RCCM : ${company.rccm} \xB7 ID Fiscal : ${company.taxId} \xB7 ${company.address}, ${company.city} \xB7 T\xE9l : ${company.phone}`,
    50,
    topY + 14,
    { width: 495 }
  );
  const lineY = topY + 29;
  doc.moveTo(50, lineY).lineTo(545, lineY).strokeColor("#E2E8F0").lineWidth(0.75).stroke();
  return lineY + 10;
}
function streamReceiptPdf(res, details, inline = true) {
  const { payment, landlord, property, tenant, lease } = details;
  const filename = `Quittance_${payment.receiptNumber}.pdf`;
  const store = getDocumentTemplatesStore();
  const company = resolveManagementCompany(store);
  const tpl = resolveReceiptTemplate(store, landlord?.id);
  const vars = buildDocumentVariables({ ...details, managementCompany: company });
  const accent = tpl.accentColor || "#0F172A";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename="${filename}"`
  );
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  doc.pipe(res);
  const headerTopY = 38;
  doc.font("Helvetica-Bold").fontSize(12).fillColor(accent).text(company.companyName.toUpperCase(), 50, headerTopY, { width: 275 });
  doc.font("Helvetica").fontSize(8).fillColor("#475569").text(
    `RCCM : ${company.rccm} \xB7 ID Fiscal : ${company.taxId}`,
    50,
    headerTopY + 15,
    { width: 275 }
  ).text(
    `${company.address}, ${company.city} \xB7 T\xE9l : ${company.phone}`,
    50,
    headerTopY + 27,
    { width: 275 }
  );
  doc.font("Helvetica-Bold").fontSize(13).fillColor(accent).text(
    interpolateTemplateVariables(tpl.documentTitle, vars),
    330,
    headerTopY,
    { align: "right", width: 215 }
  );
  doc.font("Helvetica").fontSize(9).fillColor("#334155").text(`R\xE9f : ${payment.receiptNumber}`, 330, headerTopY + 16, {
    align: "right",
    width: 215
  }).text(`P\xE9riode : ${payment.periodLabel}`, 330, headerTopY + 28, {
    align: "right",
    width: 215
  });
  const dividerY = headerTopY + 46;
  doc.moveTo(50, dividerY).lineTo(545, dividerY).strokeColor("#CBD5E1").lineWidth(1.2).stroke();
  const partiesY = dividerY + 12;
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(accent).text("BAILLEUR / PROPRI\xC9TAIRE MANDANT", 50, partiesY);
  doc.font("Helvetica").fontSize(9.5).fillColor("#334155").text(landlord.companyName || landlord.fullName, 50, partiesY + 15).text(`Repr\xE9sent\xE9 par : ${landlord.fullName}`, 50, partiesY + 29).text(landlord.address, 50, partiesY + 43, { width: 225 }).text(`T\xE9l : ${landlord.phone}`, 50, partiesY + 69).text(`ID Fiscal : ${landlord.taxId || "N/A"}`, 50, partiesY + 83);
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(accent).text("LOCATAIRE / PRENEUR", 310, partiesY);
  doc.font("Helvetica").fontSize(9.5).fillColor("#334155").text(`${tenant.firstName} ${tenant.lastName}`, 310, partiesY + 15).text(`Pi\xE8ce d'identit\xE9 : ${tenant.nationalIdNumber}`, 310, partiesY + 29).text(`T\xE9l WhatsApp : ${tenant.phoneWhatsapp}`, 310, partiesY + 43).text(`Email : ${tenant.email}`, 310, partiesY + 57).text(`Contrat : ${lease.contractNumber}`, 310, partiesY + 71);
  const propBoxY = partiesY + 104;
  doc.rect(50, propBoxY, 495, 58).fillAndStroke("#F8FAFC", "#E2E8F0");
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(accent).text(`BIEN LOU\xC9 : ${property.title} (${property.reference})`, 65, propBoxY + 10);
  doc.font("Helvetica").fontSize(9).fillColor("#334155").text(
    `Adresse : ${property.address}, ${property.neighborhood}, ${property.city}`,
    65,
    propBoxY + 25
  ).text(
    `Type : ${property.propertyType} \xB7 ${property.surfaceArea} m\xB2 \xB7 ${property.roomsCount} pi\xE8ces | GPS PostGIS : ${property.postgisWkt}`,
    65,
    propBoxY + 40
  );
  const tableTop = propBoxY + 72;
  doc.rect(50, tableTop, 495, 24).fill(accent);
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#FFFFFF").text("D\xC9SIGNATION DES SOMMES", 65, tableTop + 7).text("MONTANT", 400, tableTop + 7, { width: 130, align: "right" });
  const rentVal = Number(lease.rentAmount) || 0;
  const chargesVal = Number(lease.chargesAmount) || 0;
  const totalDueVal = Number(payment.amountDue) || rentVal + chargesVal;
  const paidVal = Number(payment.amountPaid) || 0;
  const balanceVal = Math.max(0, totalDueVal - paidVal);
  const row1Y = tableTop + 32;
  doc.font("Helvetica").fontSize(9.5).fillColor("#1E293B").text(interpolateTemplateVariables(tpl.rentRowLabel, vars), 65, row1Y, {
    width: 325
  }).text(formatCurrency(rentVal, property.currency), 400, row1Y, {
    width: 130,
    align: "right"
  });
  const row2Y = row1Y + 22;
  doc.text(interpolateTemplateVariables(tpl.chargesRowLabel, vars), 65, row2Y, {
    width: 325
  }).text(formatCurrency(chargesVal, property.currency), 400, row2Y, {
    width: 130,
    align: "right"
  });
  doc.moveTo(50, row2Y + 18).lineTo(545, row2Y + 18).strokeColor("#CBD5E1").lineWidth(1).stroke();
  const row3Y = row2Y + 26;
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(accent).text("TOTAL APPEL\xC9 POUR LA P\xC9RIODE", 65, row3Y).text(formatCurrency(totalDueVal, property.currency), 400, row3Y, {
    width: 130,
    align: "right"
  });
  const row4Y = row3Y + 22;
  doc.fillColor(payment.status === "paid" ? "#15803D" : "#B45309").text("MONTANT R\xC9GL\xC9 PAR LE LOCATAIRE", 65, row4Y).text(formatCurrency(paidVal, property.currency), 400, row4Y, {
    width: 130,
    align: "right"
  });
  const row5Y = row4Y + 22;
  doc.fillColor(balanceVal > 0 ? "#DC2626" : "#0F172A").text("RESTE \xC0 PAYER (SOLDE)", 65, row5Y).text(formatCurrency(balanceVal, property.currency), 400, row5Y, {
    width: 130,
    align: "right"
  });
  const certY = row5Y + 32;
  doc.font("Helvetica").fontSize(9.5).fillColor("#334155").text(interpolateTemplateVariables(tpl.attestationBody, vars), 50, certY, {
    width: 495,
    align: "justify",
    lineGap: 2
  });
  const afterCertY = Math.max(certY + 55, doc.y + 10);
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#1E293B").text(
    `Mode de r\xE8glement : ${payment.paymentMethod || "En attente"} | Date de r\xE8glement : ${payment.paymentDate || "Non sold\xE9"}`,
    50,
    afterCertY
  );
  const sigY = afterCertY + 26;
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(accent).text(
    `Fait \xE0 ${property.city}, le ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}`,
    260,
    sigY,
    { align: "right", width: 285 }
  ).text(interpolateTemplateVariables(tpl.signatureLabel, vars), 200, sigY + 14, {
    align: "right",
    width: 345
  });
  doc.font("Helvetica").fontSize(8).fillColor("#94A3B8").text(interpolateTemplateVariables(tpl.footerNote, vars), 50, 765, {
    align: "center",
    width: 495
  });
  doc.end();
}
function streamLeaseContractPdf(res, details, inline = true) {
  const { lease, landlord, property } = details;
  const filename = `Contrat_Bail_${lease.contractNumber}.pdf`;
  const store = getDocumentTemplatesStore();
  const company = resolveManagementCompany(store);
  const tpl = resolveLeaseTemplate(store, landlord?.id);
  const vars = buildDocumentVariables({ ...details, managementCompany: company });
  const accent = tpl.accentColor || "#1E1B4B";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename="${filename}"`
  );
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  doc.pipe(res);
  const afterBannerY = drawManagementCompanyPdfBanner(doc, company, accent, 26);
  doc.font("Helvetica-Bold").fontSize(15).fillColor(accent).text(
    interpolateTemplateVariables(tpl.documentTitle, vars),
    50,
    afterBannerY + 2,
    { align: "center" }
  );
  doc.font("Helvetica").fontSize(9.5).fillColor("#475569").text(
    interpolateTemplateVariables(tpl.documentSubtitle, vars),
    50,
    afterBannerY + 22,
    { align: "center" }
  );
  const lineY = afterBannerY + 40;
  doc.moveTo(50, lineY).lineTo(545, lineY).strokeColor(accent).lineWidth(1.5).stroke();
  let y = lineY + 10;
  const renderArticle = (title, body, extraLine) => {
    if (!title && !body) return;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(accent).text(interpolateTemplateVariables(title, vars), 50, y);
    y = doc.y + 3;
    doc.font("Helvetica").fontSize(9).fillColor("#1E293B").text(interpolateTemplateVariables(body, vars), 50, y, {
      width: 495,
      lineGap: 1.5
    });
    y = doc.y + 3;
    if (extraLine) {
      doc.font("Helvetica").fontSize(8.5).fillColor("#475569").text(extraLine, 50, y, { width: 495 });
      y = doc.y + 3;
    }
    y += 7;
  };
  renderArticle(tpl.article1Title, tpl.article1Body);
  renderArticle(
    tpl.article2Title,
    tpl.article2Body,
    tpl.showPostgisCoords ? `Coordonn\xE9es GPS certifi\xE9es (PostGIS WGS84) : Latitude ${property.latitude}, Longitude ${property.longitude} (${property.postgisWkt}).` : void 0
  );
  renderArticle(tpl.article3Title, tpl.article3Body);
  renderArticle(tpl.article4Title, tpl.article4Body);
  renderArticle(tpl.article5Title, tpl.article5Body);
  renderArticle(tpl.article6Title, tpl.article6Body);
  const sigY = Math.min(715, Math.max(y + 8, 675));
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(accent).text(interpolateTemplateVariables(tpl.landlordSignatureLabel, vars), 50, sigY, {
    width: 240
  }).text(interpolateTemplateVariables(tpl.tenantSignatureLabel, vars), 340, sigY, {
    width: 205
  });
  doc.font("Helvetica").fontSize(8).fillColor("#64748B").text(interpolateTemplateVariables(tpl.signatureSubtext, vars), 50, sigY + 14).text(
    interpolateTemplateVariables(tpl.signatureSubtext, vars),
    340,
    sigY + 14
  );
  doc.font("Helvetica").fontSize(8).fillColor("#94A3B8").text(interpolateTemplateVariables(tpl.footerText, vars), 50, 765, {
    align: "center",
    width: 495
  });
  doc.end();
}
function streamFinancialReportPdf(res, params, inline = true) {
  const { granularity, landlordId, landlords, properties, tenants, payments } = params;
  const store = getDocumentTemplatesStore();
  const company = resolveManagementCompany(store);
  const periodTitle = granularity === "daily" ? "Point Journalier (09 Novembre 2026)" : granularity === "monthly" ? "Point Mensuel (Novembre 2026)" : "Exercice Annuel Consolid\xE9 (2026)";
  const filename = `Rapport_Financier_Gimmo_${granularity}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename="${filename}"`
  );
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);
  doc.rect(0, 0, 595.28, 76).fill("#1E1B4B");
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#FCD34D").text(company.companyName.toUpperCase(), 40, 16, { width: 515 });
  doc.font("Helvetica").fontSize(8).fillColor("#E0E7FF").text(
    `RCCM : ${company.rccm} \xB7 ${company.address}, ${company.city} \xB7 T\xE9l : ${company.phone}`,
    40,
    33,
    { width: 515 }
  );
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#FFFFFF").text(
    `RAPPORT FINANCIER & REDDITION DES COMPTES \u2014 ${periodTitle}`,
    40,
    51
  );
  const landlordById = {};
  for (const l of landlords) landlordById[l.id] = l;
  const propertyById = {};
  for (const p of properties) propertyById[p.id] = p;
  const tenantById = {};
  for (const t of tenants) tenantById[t.id] = t;
  const scopedLandlords = landlords.filter(
    (l) => landlordId === "all" ? true : l.id === landlordId
  );
  const scopedPayments = payments.filter(
    (p) => landlordId === "all" ? true : p.landlordId === landlordId
  );
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const filterByGranularity = (p) => {
    if (granularity === "daily") {
      return p.paymentDate === "2026-11-09" || p.paymentDate === todayStr;
    }
    if (granularity === "monthly") {
      return p.periodMonth === "2026-11";
    }
    return String(p.periodMonth).startsWith("2026");
  };
  const periodPayments = scopedPayments.filter(filterByGranularity);
  const overduePayments = scopedPayments.filter((p) => p.status === "overdue");
  const totalExpected = periodPayments.reduce(
    (s, p) => s + Number(p.amountDue),
    0
  );
  const totalCollected = periodPayments.reduce(
    (s, p) => s + Number(p.amountPaid),
    0
  );
  const totalArrears = overduePayments.reduce(
    (s, p) => s + (Number(p.amountDue) - Number(p.amountPaid)),
    0
  );
  let y = 108;
  doc.rect(40, y, 165, 58).fillAndStroke("#EEF2FF", "#C7D2FE");
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#3730A3").text("TOTAL APPEL\xC9 (P\xC9RIODE)", 50, y + 12);
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#1E1B4B").text(formatCurrency(totalExpected), 50, y + 30);
  doc.rect(215, y, 165, 58).fillAndStroke("#ECFDF5", "#A7F3D0");
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#065F46").text("TOTAL ENCAISS\xC9", 225, y + 12);
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#047857").text(formatCurrency(totalCollected), 225, y + 30);
  doc.rect(390, y, 165, 58).fillAndStroke("#FFF1F2", "#FECDD3");
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#9F1239").text("ARRI\xC9R\xC9S / IMPAY\xC9S", 400, y + 12);
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#BE123C").text(formatCurrency(totalArrears), 400, y + 30);
  y += 80;
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#1E1B4B").text("1. SYNTH\xC8SE DES ENCAISSEMENTS ET REVERSEMENTS PAR BAILLEUR", 40, y);
  y += 20;
  doc.rect(40, y, 515, 24).fill("#312E81");
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#FFFFFF").text("BAILLEUR / SOCI\xC9T\xC9", 48, y + 7).text("APPEL\xC9", 225, y + 7, { width: 75, align: "right" }).text("ENCAISS\xC9", 305, y + 7, { width: 75, align: "right" }).text("HONORAIRES", 385, y + 7, { width: 75, align: "right" }).text("NET BAILLEUR", 465, y + 7, { width: 82, align: "right" });
  y += 28;
  for (const landlord of scopedLandlords) {
    const lPay = payments.filter((p) => p.landlordId === landlord.id).filter(filterByGranularity);
    const expected = lPay.reduce((s, p) => s + Number(p.amountDue), 0);
    const collected = lPay.reduce((s, p) => s + Number(p.amountPaid), 0);
    const fee = collected * Number(landlord.commissionRate || 8) / 100;
    const net = collected - fee;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#0F172A").text(
      `${landlord.companyName || landlord.fullName} (${landlord.commissionRate}%)`,
      48,
      y,
      { width: 175 }
    );
    doc.font("Helvetica").fontSize(9).fillColor("#334155").text(formatCurrency(expected), 225, y, { width: 75, align: "right" }).fillColor("#047857").text(formatCurrency(collected), 305, y, { width: 75, align: "right" }).fillColor("#475569").text(formatCurrency(fee), 385, y, { width: 75, align: "right" }).font("Helvetica-Bold").fillColor("#1E1B4B").text(formatCurrency(net), 465, y, { width: 82, align: "right" });
    y += 22;
    doc.moveTo(40, y - 4).lineTo(555, y - 4).strokeColor("#E2E8F0").stroke();
  }
  y += 20;
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#9F1239").text(
    `2. \xC9TAT DES LOCATAIRES EN SITUATION D'IMPAY\xC9 (${overduePayments.length} DOSSIER(S))`,
    40,
    y
  );
  y += 20;
  doc.rect(40, y, 515, 24).fill("#881337");
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#FFFFFF").text("LOCATAIRE & T\xC9L\xC9PHONE", 48, y + 7).text("BIEN IMMOBILIER", 195, y + 7).text("P\xC9RIODE", 345, y + 7).text("RETARD", 415, y + 7, { width: 50, align: "right" }).text("SOLDE D\xDB", 470, y + 7, { width: 78, align: "right" });
  y += 28;
  if (overduePayments.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor("#047857").text("Aucun locataire en situation d\u2019impay\xE9 sur ce p\xE9rim\xE8tre.", 48, y);
  } else {
    for (const p of overduePayments) {
      const tenant = tenantById[p.tenantId];
      const prop = propertyById[p.propertyId];
      const balance = Number(p.amountDue) - Number(p.amountPaid);
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#0F172A").text(
        `${tenant?.firstName || ""} ${tenant?.lastName || ""} (${tenant?.phoneWhatsapp || ""})`,
        48,
        y,
        { width: 140 }
      );
      doc.font("Helvetica").fontSize(8.5).fillColor("#334155").text(prop?.title || "Bien", 195, y, { width: 145 }).text(p.periodLabel, 345, y, { width: 65 }).fillColor("#BE123C").text(`+${p.daysLate} j`, 415, y, { width: 50, align: "right" }).font("Helvetica-Bold").text(formatCurrency(balance), 470, y, { width: 78, align: "right" });
      y += 24;
      doc.moveTo(40, y - 5).lineTo(555, y - 5).strokeColor("#FFE4E6").stroke();
    }
  }
  doc.font("Helvetica").fontSize(8).fillColor("#64748B").text(
    `${company.companyName} (RCCM ${company.rccm}) \xB7 Rapport officiel g\xE9n\xE9r\xE9 le ${todayStr} \u2014 Pr\xEAt pour impression et archivage comptable.`,
    40,
    770,
    { align: "center", width: 515 }
  );
  doc.end();
}
function streamUserGuidePdf(res, inline = true) {
  const filename = "Guide_Utilisation_Gimmo_SaaS.pdf";
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const store = getDocumentTemplatesStore();
  const company = resolveManagementCompany(store);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename="${filename}"`
  );
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);
  const drawPageHeader = (pageTitle, pageNum) => {
    doc.rect(0, 0, 595.28, 72).fill("#1E1B4B");
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#FCD34D").text(company.companyName.toUpperCase(), 40, 14, { width: 430 });
    doc.font("Helvetica-Bold").fontSize(13.5).fillColor("#FFFFFF").text("GUIDE D'UTILISATION OFFICIEL \u2014 GIMMO SAAS", 40, 30);
    doc.font("Helvetica").fontSize(8.5).fillColor("#A5B4FC").text(pageTitle, 40, 49);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#FCD34D").text(`Page ${pageNum} / 3`, 480, 24, { width: 75, align: "right" });
  };
  const drawPageFooter = (pageNum) => {
    doc.moveTo(40, 760).lineTo(555, 760).strokeColor("#CBD5E1").stroke();
    doc.font("Helvetica").fontSize(8).fillColor("#64748B").text(
      `${company.companyName} (${company.phone}) \u2014 Manuel Utilisateur Gimmo SaaS (\xC9dition ${todayStr}) \xB7 Page ${pageNum}/3`,
      40,
      768,
      { align: "center", width: 515 }
    );
  };
  const drawChapterBox = (yPos, badge, title, accentHex, bgHex, bullets) => {
    let curY = yPos;
    doc.rect(40, curY, 515, 24).fill(accentHex);
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#FFFFFF").text(`${badge}  ${title}`, 50, curY + 6);
    curY += 28;
    for (const item of bullets) {
      const descHeight = doc.heightOfString(item.desc, { width: 485 });
      const blockHeight = Math.max(28, descHeight + 18);
      doc.rect(40, curY, 515, blockHeight).fillAndStroke(bgHex, "#E2E8F0");
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#0F172A").text(`\u2022 ${item.heading}`, 50, curY + 5, { width: 495 });
      doc.font("Helvetica").fontSize(8.8).fillColor("#334155").text(item.desc, 60, curY + 18, { width: 485 });
      curY += blockHeight + 4;
    }
    return curY + 8;
  };
  drawPageHeader(
    "Chapitres 1 \xE0 3 : Navigation, Gestion Multi-Bailleurs, Cartographie GPS & Contrats de Bail",
    1
  );
  let y = 92;
  doc.rect(40, y, 515, 52).fillAndStroke("#EEF2FF", "#C7D2FE");
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#1E1B4B").text("Bienvenue dans Gimmo \u2014 Solution SaaS de Gestion Immobili\xE8re Multi-Bailleurs", 50, y + 8);
  doc.font("Helvetica").fontSize(8.8).fillColor("#3730A3").text(
    "Ce guide pratique d\xE9taille toutes les fonctionnalit\xE9s du logiciel : gestion des propri\xE9taires mandants (bailleurs), cartographie GPS PostGIS des biens, contrats de bail, quittances WhatsApp, recouvrement des impay\xE9s, param\xE9trage et mode hors-ligne.",
    50,
    y + 22,
    { width: 495 }
  );
  y += 64;
  y = drawChapterBox(
    y,
    "CHAPITRE 1",
    "NAVIGATION & GESTION DES BAILLEURS (PROPRI\xC9TAIRES MANDANTS)",
    "#312E81",
    "#F8FAFC",
    [
      {
        heading: "Menu Principal (Ordinateur & Smartphone)",
        desc: "Acc\xE9dez aux 5 modules depuis la barre sup\xE9rieure : Biens & Carte, Locataires & Baux, Quittances, Recouvrement et Param\xE9trage. Sur smartphone, appuyez sur le bouton \xAB Menu : ... (D\xE9plier) \xBB pour ouvrir le menu vertical d\xE9roulant."
      },
      {
        heading: "S\xE9lection et Filtrage par Bailleur",
        desc: "En haut de l'\xE9cran, la liste d\xE9roulante \xAB Bailleur \xBB permet d'afficher soit tous les propri\xE9taires, soit le portefeuille exclusif d'un bailleur donn\xE9 (biens g\xE9r\xE9s, loyers encaiss\xE9s, dossiers en retard)."
      },
      {
        heading: "Cr\xE9er, Modifier et Supprimer un Bailleur",
        desc: "S\xE9lectionnez un bailleur dans le menu d\xE9roulant pour faire appara\xEEtre les boutons \xAB Modifier \xBB et \xAB Supprimer \xBB (avec confirmation \xAB Confirmer ? / Annuler \xBB). Vous pouvez aussi cliquer sur \xAB G\xE9rer les Bailleurs \xBB ou aller dans \xAB Param\xE9trage \xBB pour ajouter, \xE9diter ou supprimer n'importe quel bailleur (nom, SCI, t\xE9l\xE9phone, email, RCCM, IBAN, taux de commission %)."
      }
    ]
  );
  y = drawChapterBox(
    y,
    "CHAPITRE 2",
    "PATRIMOINE IMMOBILIER & CARTOGRAPHIE GPS (POSTGIS)",
    "#047857",
    "#F0FDF4",
    [
      {
        heading: "Carte Interactive Google Maps & Code Couleur des Lots",
        desc: "Dans \xAB Biens & Carte \xBB, chaque bien est positionn\xE9 par ses coordonn\xE9es GPS WGS84 (SRID 4326). Les marqueurs affichent le loyer et changent de couleur : Indigo = Occup\xE9 \xE0 jour, Ambre = Vacant disponible, Rouge = Impay\xE9 signal\xE9."
      },
      {
        heading: "Ajouter un Bien avec G\xE9olocalisation GPS Automatique",
        desc: "Cliquez sur \xAB + Ajouter un bien GPS \xBB. Le logiciel acquiert automatiquement la position GPS de votre t\xE9l\xE9phone ou ordinateur. Vous pouvez aussi cliquer sur \xAB R\xE9cup\xE9rer ma position GPS actuelle \xBB, choisir le type de bien (qui pr\xE9-remplit les charges par d\xE9faut) et enregistrer."
      },
      {
        heading: "Modifier ou Supprimer un Bien Immobilier",
        desc: "Dans la colonne de gauche ou sur l'infobulle de la carte, cliquez sur \xAB Modifier \xBB pour mettre \xE0 jour un bien (loyer, statut, coordonn\xE9es GPS) ou sur \xAB Supprimer \xBB puis \xAB Confirmer ? \xBB pour le retirer."
      }
    ]
  );
  y = drawChapterBox(
    y,
    "CHAPITRE 3",
    "DOSSIERS LOCATAIRES & CONTRATS DE BAIL PDF",
    "#4338CA",
    "#EEF2FF",
    [
      {
        heading: "Cr\xE9ation d\u2019un Locataire & G\xE9n\xE9ration Automatique du Bail",
        desc: "Dans \xAB Locataires & Baux \xBB, cliquez sur \xAB + Nouveau Locataire & Bail \xBB. Renseignez l'\xE9tat civil, le num\xE9ro WhatsApp, la pi\xE8ce d'identit\xE9, le bien lou\xE9 et les dates. Le contrat de bail et la 1\xE8re quittance sont cr\xE9\xE9s automatiquement."
      },
      {
        heading: "Impression PDF, Partage WhatsApp & Suppression",
        desc: "Utilisez les boutons \xAB Contrat PDF \xBB pour imprimer/t\xE9l\xE9charger le bail officiel, \xAB WhatsApp \xBB pour l'envoyer au locataire, \xAB Modifier \xBB pour \xE9diter les clauses ou le loyer, et \xAB Supprimer \xBB pour cl\xF4turer et lib\xE9rer le bien."
      }
    ]
  );
  drawPageFooter(1);
  doc.addPage({ margin: 40, size: "A4" });
  drawPageHeader(
    "Chapitres 4 \xE0 6 : Quittances WhatsApp, Recouvrement des Impay\xE9s & Param\xE9trage",
    2
  );
  y = 92;
  y = drawChapterBox(
    y,
    "CHAPITRE 4",
    "QUITTANCES DE LOYER, ENCAISSEMENT & ENVOI WHATSAPP",
    "#0F766E",
    "#F0FDFA",
    [
      {
        heading: "Cr\xE9er et Filtrer les Quittances par Mois Comptable",
        desc: "Dans \xAB Quittances \xBB, filtrez par mois comptable (ex: Novembre 2026) ou par statut (Toutes, Pay\xE9es, Impay\xE9s / Retards). Cliquez sur \xAB + Cr\xE9er une Quittance \xBB pour \xE9mettre manuellement un appel de loyer ou une quittance."
      },
      {
        heading: "Encaisser un Loyer en 1 Clic",
        desc: "Sur une quittance en attente ou en retard, cliquez sur \xAB Encaisser (Mobile Money) \xBB ou \xAB Modifier \xBB pour enregistrer le r\xE8glement (Virement, Mobile Money, Esp\xE8ces, Ch\xE8que). Le statut passe imm\xE9diatement \xE0 \xAB Pay\xE9 \xBB."
      },
      {
        heading: "Aper\xE7u PDF, T\xE9l\xE9chargement & Envoi WhatsApp Direct",
        desc: "Chaque quittance dispose d'un bouton \xAB Aper\xE7u / PDF \xBB (ouverture et t\xE9l\xE9chargement du PDF officiel) et d'un bouton \xAB Envoyer Quittance WhatsApp \xBB qui g\xE9n\xE8re un message pr\xE9-rempli avec le lien PDF s\xE9curis\xE9 pr\xEAt \xE0 \xEAtre envoy\xE9 au locataire."
      }
    ]
  );
  y = drawChapterBox(
    y,
    "CHAPITRE 5",
    "SUIVI FINANCIER, RECOUVREMENT DES IMPAY\xC9S & REDDITION BAILLEURS",
    "#BE123C",
    "#FFF1F2",
    [
      {
        heading: "Tableau Automatique des Locataires en Retard (Impay\xE9s)",
        desc: "Dans \xAB Recouvrement \xBB, la section 01 liste automatiquement tous les locataires ayant d\xE9pass\xE9 la date d'exigibilit\xE9 du mois, avec le nombre de jours de retard (+X jours) et le solde impay\xE9 exact."
      },
      {
        heading: "Relance WhatsApp en 1 Clic & R\xE9gularisation",
        desc: "Cliquez sur \xAB Relance WhatsApp \xBB pour envoyer un rappel courtois chiffr\xE9 au locataire, ou sur \xAB R\xE9gulariser & Quittancer \xBB d\xE8s r\xE9ception des fonds."
      },
      {
        heading: "Rapport Financier par P\xE9riode & Calcul du Net \xE0 Reverser",
        desc: "Basculez entre \xAB Journalier \xBB, \xAB Mensuel \xBB et \xAB Annuel \xBB. Le tableau calcule automatiquement pour chaque bailleur : Total Appel\xE9, Total Encaiss\xE9, Impay\xE9s, Honoraires Agence (%) et Net \xE0 Reverser. Cliquez sur \xAB Imprimer le Rapport PDF \xBB ou \xAB T\xE9l\xE9charger PDF \xBB pour exporter l'\xE9tat comptable."
      }
    ]
  );
  y = drawChapterBox(
    y,
    "CHAPITRE 6",
    "PARAM\xC9TRAGE : TYPES DE BIENS, MOIS COMPTABLES & MOD\xC8LES PDF",
    "#6D28D9",
    "#F5F3FF",
    [
      {
        heading: "Cr\xE9ation et Modification des Types de Biens Immobiliers",
        desc: "Dans \xAB Param\xE9trage \xBB, ajoutez vos propres types de biens (ex: Duplex, Entrep\xF4t, Magasin) avec leur code court, cat\xE9gorie d'usage et charges par d\xE9faut. Si vous renommez un type existant via \xAB Modifier \xBB, tous les biens rattach\xE9s sont mis \xE0 jour automatiquement."
      },
      {
        heading: "Ouverture des Mois Comptables & Appels de Loyers Automatiques",
        desc: "Cr\xE9ez un nouveau mois comptable (ex: D\xE9cembre 2026), d\xE9finissez-le comme \xAB Mois Actif par d\xE9faut \xBB et cochez la g\xE9n\xE9ration automatique pour cr\xE9er en un clic les quittances de tous les baux actifs."
      },
      {
        heading: "Personnalisation des Mod\xE8les de Contrat de Bail & Quittance",
        desc: "Cliquez sur \xAB Mod\xE8les Bail & Quittance \xBB pour personnaliser les titres, articles, clauses, couleurs et variables dynamiques ({{nom_locataire}}, {{montant_loyer_ttc}}, {{nom_bailleur}}) pour toute l'agence ou par bailleur."
      }
    ]
  );
  drawPageFooter(2);
  doc.addPage({ margin: 40, size: "A4" });
  drawPageHeader(
    "Chapitre 7 & R\xE9capitulatif : Mode Hors-Ligne, Synchro Temps R\xE9el & Application Mobile PWA",
    3
  );
  y = 92;
  y = drawChapterBox(
    y,
    "CHAPITRE 7",
    "MODE HORS-LIGNE (OFFLINE), SYNCHRO TEMPS R\xC9EL & APPLICATION MOBILE",
    "#B45309",
    "#FFFBEB",
    [
      {
        heading: "Continuit\xE9 de Service en Mode Hors-Ligne (Sans Internet)",
        desc: "Gimmo sauvegarde en permanence un instantan\xE9 local de votre portefeuille. En cas de coupure Internet (ou en cliquant sur le bouton \xAB Synchro Temps R\xE9el Active \xBB pour passer en \xAB Mode Hors-Ligne Actif \xBB), vous pouvez continuer \xE0 cr\xE9er, modifier ou supprimer des biens, bailleurs, baux et quittances sur le terrain."
      },
      {
        heading: "Synchronisation Automatique & Temps R\xE9el Multi-Appareils",
        desc: "D\xE8s le retour de la connexion, cliquez sur \xAB Synchroniser (X) \xBB ou repassez en ligne : toutes les op\xE9rations enregistr\xE9es hors-ligne sont envoy\xE9es au serveur PostgreSQL et diffus\xE9es en temps r\xE9el (WebSocket / SSE) \xE0 tous vos collaborateurs connect\xE9s."
      },
      {
        heading: "Installation sur Smartphone Android, iPhone (iOS) & Ordinateur (PWA)",
        desc: "Dans \xAB Param\xE9trage \xBB, cliquez sur le bouton \xAB Application Mobile / PWA \xBB (\xAB Installer l'application \xBB) pour ajouter l'ic\xF4ne Gimmo directement sur l'\xE9cran d'accueil de votre t\xE9l\xE9phone ou sur le bureau de votre PC."
      }
    ]
  );
  y += 6;
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#1E1B4B").text("AIDE-M\xC9MOIRE DES ACTIONS RAPIDES DANS GIMMO", 40, y);
  y += 18;
  doc.rect(40, y, 515, 22).fill("#1E1B4B");
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#FFFFFF").text("OBJECTIF / OP\xC9RATION", 48, y + 6).text("RUBRIQUE / EMPLACEMENT", 235, y + 6).text("BOUTON D\u2019ACTION \xC0 UTILISER", 385, y + 6);
  const quickActions = [
    [
      "Modifier ou supprimer un bailleur",
      "Barre sup\xE9rieure ou Param\xE9trage",
      "S\xE9lectionner le bailleur -> \xAB Modifier \xBB / \xAB Supprimer \xBB"
    ],
    [
      "Ajouter un bien avec position GPS",
      "Biens & Carte",
      "\xAB + Ajouter un bien GPS \xBB (acquisition auto WGS84)"
    ],
    [
      "Cr\xE9er ou modifier un type de bien",
      "Param\xE9trage -> Types de Biens",
      "Formulaire d\u2019ajout ou bouton \xAB Modifier \xBB sur la ligne"
    ],
    [
      "Ouvrir un nouveau mois comptable",
      "Param\xE9trage -> Mois Comptables",
      "\xAB Cr\xE9er un Mois Comptable \xBB (+ g\xE9n\xE9ration quittances)"
    ],
    [
      "\xC9mettre ou encaisser une quittance",
      "Quittances",
      "\xAB + Cr\xE9er une Quittance \xBB ou \xAB Encaisser \xBB"
    ],
    [
      "Relancer un impay\xE9 sur WhatsApp",
      "Recouvrement (Section 01)",
      "\xAB Relance WhatsApp \xBB puis \xAB R\xE9gulariser & Quittancer \xBB"
    ],
    [
      "Exporter le rapport financier PDF",
      "Recouvrement (Haut de page)",
      "\xAB Imprimer le Rapport PDF \xBB / \xAB T\xE9l\xE9charger PDF \xBB"
    ],
    [
      "Adapter les clauses Bail / Quittance",
      "Param\xE9trage",
      "\xAB Mod\xE8les Bail & Quittance \xBB"
    ]
  ];
  y += 24;
  for (let i = 0; i < quickActions.length; i++) {
    const [goal, loc, action] = quickActions[i];
    const rowBg = i % 2 === 0 ? "#F8FAFC" : "#EEF2FF";
    doc.rect(40, y, 515, 22).fillAndStroke(rowBg, "#E2E8F0");
    doc.font("Helvetica-Bold").fontSize(8.3).fillColor("#0F172A").text(goal, 48, y + 6, { width: 180 });
    doc.font("Helvetica").fontSize(8.3).fillColor("#334155").text(loc, 235, y + 6, { width: 145 });
    doc.font("Helvetica-Bold").fontSize(8.3).fillColor("#3730A3").text(action, 385, y + 6, { width: 165 });
    y += 22;
  }
  drawPageFooter(3);
  doc.end();
}

// src/server/create-app.ts
async function getDashboardDataWithTemplates() {
  const [dbData, freshTemplates] = await Promise.all([
    getAllDashboardData(),
    initTemplatesStoreFromDb()
  ]);
  return {
    ...dbData,
    templates: freshTemplates
  };
}
function createGimmoApiApp(options = {}) {
  const app2 = express();
  app2.set("trust proxy", true);
  app2.use(express.json({ limit: "4mb" }));
  const notifyMutated = async (action) => {
    if (options.onStateMutated) {
      await options.onStateMutated(action);
    }
  };
  if (options.serverlessMode) {
    app2.get("/api/realtime/events", (_req, res) => {
      res.status(204).end();
    });
  }
  app2.get("/api/supabase/health", async (_req, res) => {
    try {
      const status = await checkSupabaseTablesStatus();
      return res.json(status);
    } catch (error) {
      return res.status(500).json({
        configured: false,
        error: error?.message || "Erreur lors de la v\xE9rification Supabase"
      });
    }
  });
  app2.post("/api/auth/sync", requireAuth, async (req, res) => {
    try {
      const uid = req.user?.uid || "global_demo";
      const email = req.user?.email || "gestionnaire@gimmo.ci";
      const name = req.user?.name;
      const user = await getOrCreateUser(uid, email, name);
      res.json({ user });
    } catch (error) {
      console.error("Auth sync error:", error);
      res.status(500).json({ error: error.message || "Auth sync failed" });
    }
  });
  app2.get("/api/gimmo/overview", async (_req, res) => {
    try {
      const data = await getDashboardDataWithTemplates();
      res.json(data);
    } catch (error) {
      console.error("Overview error:", error);
      res.status(500).json({ error: error.message || "Erreur lors du chargement des donn\xE9es" });
    }
  });
  app2.post("/api/gimmo/sync-batch", async (req, res) => {
    try {
      const mutations = Array.isArray(req.body?.mutations) ? req.body.mutations : [];
      for (const item of mutations) {
        try {
          const { url, method, body } = item;
          if (url === "/api/properties" && method === "POST") {
            await createPropertyRecord({ userId: "global_demo", ...body });
          } else if (url?.startsWith("/api/properties/") && method === "PUT") {
            const id = Number(url.split("/").pop());
            await updatePropertyRecord(id, body);
          } else if (url === "/api/landlords" && method === "POST") {
            await createLandlordRecord({ userId: "global_demo", ...body });
          } else if (url?.startsWith("/api/landlords/") && method === "PUT") {
            const id = Number(url.split("/").pop());
            await updateLandlordRecord(id, body);
          } else if (url === "/api/tenants-leases" && method === "POST") {
            await createTenantAndLeaseRecord({ userId: "global_demo", ...body });
          } else if (url?.startsWith("/api/tenants-leases/") && method === "PUT") {
            const id = Number(url.split("/").pop());
            await updateTenantAndLeaseRecord(id, body);
          } else if (url === "/api/payments" && method === "POST") {
            await createPaymentRecord({ userId: "global_demo", ...body });
          } else if (url?.endsWith("/settle") && method === "POST") {
            const parts = url.split("/");
            const paymentId = Number(parts[parts.length - 2]);
            await markPaymentAsPaid(paymentId, body?.paymentMethod || "Mobile Money");
          } else if (url?.startsWith("/api/payments/") && method === "PUT") {
            const id = Number(url.split("/").pop());
            await updatePaymentRecord(id, body);
          } else if (url === "/api/templates" && method === "PUT") {
            await saveDocumentTemplateEntry(body);
          } else if (url === "/api/accounting-months" && method === "POST") {
            await upsertAccountingMonthEntry(body);
            if (body?.autoGenerateRentCalls) {
              await generateRentCallsForMonthRecord({
                userId: "global_demo",
                periodMonth: body.periodMonth,
                periodLabel: body.periodLabel,
                defaultDueDay: Number(body.defaultDueDay || 5),
                initialStatus: body.initialStatus || "pending"
              });
            }
          } else if (url?.startsWith("/api/properties/") && method === "DELETE") {
            const id = Number(url.split("/").pop());
            await deletePropertyRecord(id);
          } else if (url?.startsWith("/api/landlords/") && method === "DELETE") {
            const id = Number(url.split("/").pop());
            await deleteLandlordRecord(id);
          } else if (url?.startsWith("/api/tenants-leases/") && method === "DELETE") {
            const id = Number(url.split("/").pop());
            await deleteLeaseRecord(id);
          } else if (url?.startsWith("/api/payments/") && method === "DELETE") {
            const id = Number(url.split("/").pop());
            await deletePaymentRecord(id);
          } else if (url?.startsWith("/api/accounting-months/") && method === "DELETE") {
            const periodMonth = decodeURIComponent(url.split("/").pop() || "");
            await deleteAccountingMonthEntry(periodMonth);
          } else if (url === "/api/property-types" && method === "POST") {
            await upsertPropertyTypeEntry(body);
            if (body?.previousName && body.previousName !== body.name) {
              await renamePropertyTypeInRecords(body.previousName, body.name);
            }
          } else if (url?.startsWith("/api/property-types/") && method === "DELETE") {
            const id = decodeURIComponent(url.split("/").pop() || "");
            await deletePropertyTypeEntry(id);
          } else if (url === "/api/management-company" && method === "PUT") {
            await saveManagementCompanyEntry(body || {});
          } else if (url === "/api/saas/tenants" && method === "POST") {
            if (body?.companyName) {
              await upsertSaaSTenantEntry(body);
            }
          } else if (url?.startsWith("/api/saas/tenants/") && method === "DELETE") {
            const id = decodeURIComponent(url.split("/").pop() || "");
            await deleteSaaSTenantEntry(id);
          } else if (url === "/api/saas/users" && method === "POST") {
            if (body?.email && body?.fullName) {
              await upsertSaaSUserEntry(body);
            }
          } else if (url?.startsWith("/api/saas/users/") && method === "DELETE") {
            const id = decodeURIComponent(url.split("/").pop() || "");
            await deleteSaaSUserEntry(id);
          }
        } catch (mutationErr) {
          console.warn("Skipping failed queued mutation during batch sync:", mutationErr);
        }
      }
      const data = await getDashboardDataWithTemplates();
      await notifyMutated(
        `Synchronisation arri\xE8re-plan (${mutations.length} op\xE9ration(s))`
      );
      res.json({ success: true, syncedCount: mutations.length, data });
    } catch (error) {
      console.error("Batch sync error:", error);
      res.status(500).json({ error: error.message || "Erreur de synchronisation" });
    }
  });
  app2.put("/api/templates", async (req, res) => {
    try {
      const { scopeKey, kind, config: config2 } = req.body || {};
      if (!scopeKey || kind !== "lease" && kind !== "receipt" || !config2) {
        return res.status(400).json({ error: "Param\xE8tres de mod\xE8le invalides" });
      }
      const updatedStore = await saveDocumentTemplateEntry({ scopeKey, kind, config: config2 });
      await notifyMutated(
        `Mod\xE8le de ${kind === "lease" ? "Contrat de Bail" : "Quittance"} mis \xE0 jour (${scopeKey})`
      );
      res.json({ templates: updatedStore });
    } catch (error) {
      res.status(500).json({ error: error.message || "Erreur sauvegarde mod\xE8le" });
    }
  });
  app2.post("/api/accounting-months", async (req, res) => {
    try {
      const {
        periodMonth,
        periodLabel,
        defaultDueDay,
        status,
        isCurrent,
        autoGenerateRentCalls,
        initialStatus
      } = req.body || {};
      if (!periodMonth || !periodLabel) {
        return res.status(400).json({ error: "Le code du mois (YYYY-MM) et le libell\xE9 sont requis" });
      }
      const updatedStore = await upsertAccountingMonthEntry({
        periodMonth,
        periodLabel,
        defaultDueDay: Number(defaultDueDay || 5),
        status: status || "open",
        isCurrent
      });
      let generatedCount = 0;
      if (autoGenerateRentCalls) {
        const createdPayments = await generateRentCallsForMonthRecord({
          userId: "global_demo",
          periodMonth,
          periodLabel,
          defaultDueDay: Number(defaultDueDay || 5),
          initialStatus: initialStatus || "pending"
        });
        generatedCount = createdPayments.length;
      }
      await notifyMutated(
        `Mois comptable ${periodLabel} enregistr\xE9 (${generatedCount} appel(s) g\xE9n\xE9r\xE9(s))`
      );
      res.status(201).json({
        templates: updatedStore,
        generatedCount
      });
    } catch (error) {
      res.status(500).json({ error: error.message || "Erreur cr\xE9ation mois comptable" });
    }
  });
  app2.post("/api/property-types", async (req, res) => {
    try {
      const {
        id,
        name,
        code,
        category,
        defaultCharges,
        description,
        previousName
      } = req.body || {};
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "Le nom du type de bien est requis" });
      }
      const updatedStore = await upsertPropertyTypeEntry({
        id,
        name: String(name).trim(),
        code,
        category,
        defaultCharges,
        description
      });
      if (previousName && previousName !== String(name).trim()) {
        await renamePropertyTypeInRecords(previousName, String(name).trim());
      }
      await notifyMutated(
        `Type de bien enregistr\xE9 : ${String(name).trim()}`
      );
      res.status(201).json({ templates: updatedStore });
    } catch (error) {
      res.status(500).json({ error: error.message || "Erreur sauvegarde type de bien" });
    }
  });
  app2.delete("/api/property-types/:id", async (req, res) => {
    try {
      const id = decodeURIComponent(req.params.id);
      const updatedStore = await deletePropertyTypeEntry(id);
      await notifyMutated(`Type de bien supprim\xE9 : ${id}`);
      res.json({ success: true, templates: updatedStore });
    } catch (error) {
      res.status(500).json({ error: error.message || "Erreur suppression type de bien" });
    }
  });
  app2.put("/api/management-company", async (req, res) => {
    try {
      const payload = req.body || {};
      if (!payload.companyName || !String(payload.companyName).trim()) {
        return res.status(400).json({ error: "La raison sociale de la soci\xE9t\xE9 de gestion est requise" });
      }
      const updatedStore = await saveManagementCompanyEntry(payload);
      await notifyMutated(
        `Soci\xE9t\xE9 de gestion mise \xE0 jour : ${String(payload.companyName).trim()}`
      );
      res.json({ templates: updatedStore });
    } catch (error) {
      res.status(500).json({ error: error.message || "Erreur sauvegarde soci\xE9t\xE9 de gestion" });
    }
  });
  app2.post("/api/saas/tenants", async (req, res) => {
    try {
      const payload = req.body || {};
      if (!payload.companyName || !String(payload.companyName).trim()) {
        return res.status(400).json({ error: "Le nom de la soci\xE9t\xE9/agence SaaS est requis" });
      }
      const updatedStore = await upsertSaaSTenantEntry(payload);
      await notifyMutated(
        `Agence SaaS enregistr\xE9e : ${String(payload.companyName).trim()}`
      );
      res.status(201).json({ templates: updatedStore });
    } catch (error) {
      res.status(400).json({ error: error.message || "Erreur sauvegarde agence SaaS" });
    }
  });
  app2.delete("/api/saas/tenants/:id", async (req, res) => {
    try {
      const id = decodeURIComponent(req.params.id);
      const updatedStore = await deleteSaaSTenantEntry(id);
      await notifyMutated(`Agence SaaS supprim\xE9e : ${id}`);
      res.json({ success: true, templates: updatedStore });
    } catch (error) {
      res.status(500).json({ error: error.message || "Erreur suppression agence SaaS" });
    }
  });
  app2.post("/api/saas/login", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const result = await authenticateSaaSUserEntry(
        String(email || ""),
        String(password || "")
      );
      if (!result.ok) {
        return res.status(result.status).json({
          ok: false,
          code: result.code,
          error: result.error
        });
      }
      res.json({
        ok: true,
        user: result.user,
        agency: result.agency,
        templates: result.templates
      });
      void notifyMutated(
        `Connexion utilisateur : ${result.user?.email || email}`
      );
      return;
    } catch (error) {
      console.error("SaaS login error:", error);
      return res.status(500).json({
        ok: false,
        error: error?.message || "Impossible de joindre la base Supabase pour v\xE9rifier vos identifiants."
      });
    }
  });
  app2.post("/api/saas/users", async (req, res) => {
    try {
      const payload = req.body || {};
      if (!payload.email || !payload.fullName) {
        return res.status(400).json({ error: "Le nom complet et l\u2019email de l\u2019utilisateur SaaS sont requis" });
      }
      const updatedStore = await upsertSaaSUserEntry(payload);
      await notifyMutated(
        `Compte utilisateur SaaS mis \xE0 jour : ${String(payload.email).trim()}`
      );
      res.status(201).json({ templates: updatedStore });
    } catch (error) {
      const msg = error.message || "Erreur sauvegarde utilisateur SaaS";
      const status = msg.includes("Acc\xE8s refus\xE9") ? 403 : 400;
      res.status(status).json({ error: msg });
    }
  });
  app2.delete("/api/saas/users/:id", async (req, res) => {
    try {
      const id = decodeURIComponent(req.params.id);
      const actor = {
        actorRole: req.body?.actorRole || req.query.actorRole,
        actorEmail: req.body?.actorEmail || req.query.actorEmail,
        actorTenantId: req.body?.actorTenantId || req.query.actorTenantId
      };
      const updatedStore = await deleteSaaSUserEntry(id, actor);
      await notifyMutated(`Compte utilisateur SaaS supprim\xE9 : ${id}`);
      res.json({ success: true, templates: updatedStore });
    } catch (error) {
      const msg = error.message || "Erreur suppression utilisateur SaaS";
      const status = msg.includes("Acc\xE8s refus\xE9") ? 403 : 400;
      res.status(status).json({ error: msg });
    }
  });
  app2.post("/api/receipts/:paymentId/whatsapp-share", async (req, res) => {
    try {
      const paymentId = Number(req.params.paymentId);
      if (isNaN(paymentId)) {
        return res.status(400).json({ error: "Identifiant de paiement invalide" });
      }
      const details = await getPaymentFullDetailsById(paymentId);
      if (!details) {
        return res.status(404).json({ error: "Quittance introuvable" });
      }
      const { payment, landlord, property, tenant } = details;
      const baseUrl = process.env.APP_URL && !process.env.APP_URL.includes("MY_APP_URL") ? process.env.APP_URL.replace(/\/$/, "") : `${req.protocol}://${req.get("host")}`;
      const pdfUrl = `${baseUrl}/api/public/receipts/${payment.shareToken}/pdf`;
      const cleanPhone = tenant.phoneWhatsapp.replace(/[^0-9]/g, "");
      const amountFormatted = `${Number(payment.amountPaid || payment.amountDue).toLocaleString("fr-FR")} ${property.currency}`;
      const messageText = [
        `Bonjour ${tenant.firstName} ${tenant.lastName},`,
        ``,
        `Veuillez trouver ci-joint votre *Quittance de Loyer N\xB0 ${payment.receiptNumber}* pour la p\xE9riode de *${payment.periodLabel}*.`,
        `\u2022 Bien : ${property.title} (${property.neighborhood})`,
        `\u2022 Bailleur : ${landlord.companyName || landlord.fullName}`,
        `\u2022 Montant quittanc\xE9 : *${amountFormatted}*`,
        ``,
        `\u{1F4C4} T\xE9l\xE9charger votre quittance PDF officielle :`,
        pdfUrl,
        ``,
        `Cordialement,`,
        `La Gestion Locative Gimmo`
      ].join("\n");
      const whatsappClickToChatUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
      const cloudApiPayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "document",
        document: {
          link: pdfUrl,
          caption: `Quittance de loyer ${payment.receiptNumber} - ${payment.periodLabel} (${amountFormatted})`,
          filename: `Quittance_${payment.receiptNumber}.pdf`
        }
      };
      let cloudApiStatus = "ready_via_share_link";
      const waToken = process.env.WHATSAPP_CLOUD_API_TOKEN;
      const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (waToken && waPhoneId) {
        const waResponse = await fetch(
          `https://graph.facebook.com/v21.0/${waPhoneId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${waToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(cloudApiPayload)
          }
        );
        if (waResponse.ok) {
          cloudApiStatus = "sent_via_cloud_api";
        }
      }
      await markWhatsappSent(paymentId);
      await notifyMutated(`Quittance ${payment.receiptNumber} partag\xE9e sur WhatsApp`);
      return res.json({
        success: true,
        receiptNumber: payment.receiptNumber,
        tenantName: `${tenant.firstName} ${tenant.lastName}`,
        phoneWhatsapp: tenant.phoneWhatsapp,
        pdfUrl,
        whatsappShareUrl: whatsappClickToChatUrl,
        cloudApiStatus,
        cloudApiPayload
      });
    } catch (error) {
      console.error("WhatsApp share generation error:", error);
      return res.status(500).json({
        error: error.message || "Erreur lors de la g\xE9n\xE9ration du lien WhatsApp"
      });
    }
  });
  app2.post("/api/leases/:leaseId/whatsapp-share", async (req, res) => {
    try {
      const leaseId = Number(req.params.leaseId);
      const details = await getLeaseFullDetailsById(leaseId);
      if (!details) {
        return res.status(404).json({ error: "Contrat de bail introuvable" });
      }
      const { lease, landlord, property, tenant } = details;
      const baseUrl = process.env.APP_URL && !process.env.APP_URL.includes("MY_APP_URL") ? process.env.APP_URL.replace(/\/$/, "") : `${req.protocol}://${req.get("host")}`;
      const pdfUrl = `${baseUrl}/api/public/leases/${lease.shareToken}/pdf`;
      const cleanPhone = tenant.phoneWhatsapp.replace(/[^0-9]/g, "");
      const messageText = [
        `Bonjour ${tenant.firstName} ${tenant.lastName},`,
        ``,
        `Votre *Contrat de Bail Locatif N\xB0 ${lease.contractNumber}* (${landlord.companyName || landlord.fullName}) concernant le bien *${property.title}* est disponible en PDF :`,
        pdfUrl,
        ``,
        `Cordialement,`,
        `Gimmo SaaS`
      ].join("\n");
      const whatsappShareUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
      return res.json({
        success: true,
        contractNumber: lease.contractNumber,
        pdfUrl,
        whatsappShareUrl
      });
    } catch (error) {
      console.error("Lease WhatsApp share error:", error);
      return res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/public/receipts/:shareToken/pdf", async (req, res) => {
    try {
      await initTemplatesStoreFromDb();
      const details = await getPaymentFullDetailsByToken(req.params.shareToken);
      if (!details) {
        return res.status(404).send("Quittance introuvable ou lien expir\xE9.");
      }
      const download = req.query.download === "1";
      streamReceiptPdf(res, details, !download);
    } catch (error) {
      console.error("Error streaming receipt PDF:", error);
      res.status(500).send("Erreur lors de la g\xE9n\xE9ration du PDF de quittance.");
    }
  });
  app2.get("/api/public/leases/:shareToken/pdf", async (req, res) => {
    try {
      await initTemplatesStoreFromDb();
      const details = await getLeaseFullDetailsByToken(req.params.shareToken);
      if (!details) {
        return res.status(404).send("Contrat de bail introuvable.");
      }
      const download = req.query.download === "1";
      streamLeaseContractPdf(res, details, !download);
    } catch (error) {
      console.error("Error streaming lease PDF:", error);
      res.status(500).send("Erreur lors de la g\xE9n\xE9ration du PDF du contrat.");
    }
  });
  app2.post("/api/payments/:paymentId/settle", async (req, res) => {
    try {
      const paymentId = Number(req.params.paymentId);
      const { paymentMethod } = req.body || {};
      const updated = await markPaymentAsPaid(paymentId, paymentMethod || "Mobile Money");
      await notifyMutated(`Quittance ${updated.receiptNumber} encaiss\xE9e`);
      res.json({ payment: updated });
    } catch (error) {
      res.status(500).json({ error: error.message || "\xC9chec de l\u2019encaissement" });
    }
  });
  app2.post("/api/properties", async (req, res) => {
    try {
      const created = await createPropertyRecord({
        userId: "global_demo",
        ...req.body
      });
      await notifyMutated(`Bien ajout\xE9 : ${created.reference}`);
      res.status(201).json({ property: created });
    } catch (error) {
      res.status(500).json({ error: error.message || "Erreur cr\xE9ation bien" });
    }
  });
  app2.post("/api/landlords", async (req, res) => {
    try {
      const created = await createLandlordRecord({
        userId: "global_demo",
        ...req.body
      });
      await notifyMutated(`Bailleur ajout\xE9 : ${created.companyName || created.fullName}`);
      res.status(201).json({ landlord: created });
    } catch (error) {
      res.status(500).json({ error: error.message || "Erreur cr\xE9ation bailleur" });
    }
  });
  app2.post("/api/landlords/:id/portal-credentials", async (req, res) => {
    try {
      const landlordId = Number(req.params.id);
      if (isNaN(landlordId)) {
        return res.status(400).json({ error: "Identifiant bailleur invalide" });
      }
      const { portalUsername, portalPassword, portalEnabled, regeneratePassword } = req.body || {};
      const [updatedLandlord, freshTemplates] = await Promise.all([
        upsertLandlordPortalCredentialsRecord(landlordId, {
          portalUsername,
          portalPassword,
          portalEnabled,
          regeneratePassword
        }),
        initTemplatesStoreFromDb()
      ]);
      const baseUrl = process.env.APP_URL && !process.env.APP_URL.includes("MY_APP_URL") ? process.env.APP_URL.replace(/\/$/, "") : `${req.protocol}://${req.get("host")}`;
      const managementCompany = resolveManagementCompany(freshTemplates);
      const whatsapp = buildLandlordPortalWhatsAppDetails({
        landlord: updatedLandlord,
        agencyName: managementCompany.tradeName || managementCompany.companyName || "Gimmo",
        baseUrl
      });
      let cloudApiStatus = "ready_via_share_link";
      const waToken = process.env.WHATSAPP_CLOUD_API_TOKEN;
      const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (waToken && waPhoneId && whatsapp.sanitizedDigits) {
        try {
          const waResponse = await fetch(
            `https://graph.facebook.com/v21.0/${waPhoneId}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${waToken}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: whatsapp.sanitizedDigits,
                type: "text",
                text: {
                  preview_url: true,
                  body: whatsapp.messageText
                }
              })
            }
          );
          if (waResponse.ok) {
            cloudApiStatus = "sent_via_cloud_api";
          }
        } catch (waErr) {
          console.warn("WhatsApp Cloud API landlord credentials send skipped:", waErr);
        }
      }
      await notifyMutated(
        `Acc\xE8s Portail Bailleur mis \xE0 jour : ${updatedLandlord.companyName || updatedLandlord.fullName}`
      );
      return res.json({
        success: true,
        landlord: updatedLandlord,
        whatsapp,
        cloudApiStatus
      });
    } catch (error) {
      return res.status(400).json({
        error: error.message || "Erreur lors de la g\xE9n\xE9ration des identifiants du Portail Bailleur"
      });
    }
  });
  app2.post("/api/landlord-portal/login", async (req, res) => {
    try {
      const { identifier, password } = req.body || {};
      const [portfolio, freshTemplates] = await Promise.all([
        authenticateLandlordPortalRecord(
          String(identifier || ""),
          String(password || "")
        ),
        initTemplatesStoreFromDb()
      ]);
      const managementCompany = resolveManagementCompany(freshTemplates);
      return res.json({
        ...portfolio,
        managementCompany,
        authenticatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      return res.status(401).json({
        error: error.message || "Identifiant ou mot de passe bailleur invalide."
      });
    }
  });
  app2.post("/api/landlord-portal/refresh", async (req, res) => {
    try {
      const { landlordId, password } = req.body || {};
      const [portfolio, freshTemplates] = await Promise.all([
        authenticateLandlordPortalRecord(
          "",
          String(password || ""),
          Number(landlordId)
        ),
        initTemplatesStoreFromDb()
      ]);
      const managementCompany = resolveManagementCompany(freshTemplates);
      return res.json({
        ...portfolio,
        managementCompany,
        authenticatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      return res.status(401).json({
        error: error.message || "Session Portail Bailleur expir\xE9e."
      });
    }
  });
  app2.post("/api/tenants-leases", async (req, res) => {
    try {
      const created = await createTenantAndLeaseRecord({
        userId: "global_demo",
        ...req.body
      });
      await notifyMutated(`Nouveau bail cr\xE9\xE9 : ${created.lease.contractNumber}`);
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: error.message || "Erreur cr\xE9ation dossier locataire" });
    }
  });
  app2.put("/api/properties/:id", async (req, res) => {
    try {
      const propertyId = Number(req.params.id);
      const updated = await updatePropertyRecord(propertyId, req.body);
      await notifyMutated(`Bien mis \xE0 jour : ${updated.reference}`);
      res.json({ property: updated });
    } catch (error) {
      res.status(500).json({ error: error.message || "Erreur modification bien" });
    }
  });
  app2.put("/api/landlords/:id", async (req, res) => {
    try {
      const landlordId = Number(req.params.id);
      const updated = await updateLandlordRecord(landlordId, req.body);
      await notifyMutated(`Bailleur mis \xE0 jour : ${updated.companyName || updated.fullName}`);
      res.json({ landlord: updated });
    } catch (error) {
      res.status(500).json({ error: error.message || "Erreur modification bailleur" });
    }
  });
  app2.put("/api/tenants-leases/:leaseId", async (req, res) => {
    try {
      const leaseId = Number(req.params.leaseId);
      const updated = await updateTenantAndLeaseRecord(leaseId, req.body);
      await notifyMutated(`Contrat mis \xE0 jour : ${updated.lease.contractNumber}`);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message || "Erreur modification dossier locataire" });
    }
  });
  app2.put("/api/payments/:id", async (req, res) => {
    try {
      const paymentId = Number(req.params.id);
      const updated = await updatePaymentRecord(paymentId, req.body);
      await notifyMutated(`Quittance mise \xE0 jour : ${updated.receiptNumber}`);
      res.json({ payment: updated });
    } catch (error) {
      res.status(500).json({ error: error.message || "Erreur modification quittance" });
    }
  });
  app2.post("/api/payments", async (req, res) => {
    try {
      const created = await createPaymentRecord({
        userId: "global_demo",
        ...req.body
      });
      await notifyMutated(`Nouvelle quittance \xE9mise : ${created.receiptNumber}`);
      res.status(201).json({ payment: created });
    } catch (error) {
      res.status(500).json({ error: error.message || "Erreur cr\xE9ation quittance" });
    }
  });
  app2.delete("/api/properties/:id", async (req, res) => {
    try {
      const propertyId = Number(req.params.id);
      const deleted = await deletePropertyRecord(propertyId);
      await notifyMutated(
        `Bien supprim\xE9 : ${deleted?.reference || `#${propertyId}`}`
      );
      res.json({ success: true, deleted });
    } catch (error) {
      res.status(500).json({ error: error.message || "Erreur suppression bien" });
    }
  });
  app2.delete("/api/landlords/:id", async (req, res) => {
    try {
      const landlordId = Number(req.params.id);
      const deleted = await deleteLandlordRecord(landlordId);
      await notifyMutated(
        `Bailleur supprim\xE9 : ${deleted?.companyName || deleted?.fullName || `#${landlordId}`}`
      );
      res.json({ success: true, deleted });
    } catch (error) {
      res.status(500).json({ error: error.message || "Erreur suppression bailleur" });
    }
  });
  app2.delete("/api/tenants-leases/:leaseId", async (req, res) => {
    try {
      const leaseId = Number(req.params.leaseId);
      const deleted = await deleteLeaseRecord(leaseId);
      await notifyMutated(
        `Contrat de bail supprim\xE9 : ${deleted?.contractNumber || `#${leaseId}`}`
      );
      res.json({ success: true, deleted });
    } catch (error) {
      res.status(500).json({ error: error.message || "Erreur suppression contrat" });
    }
  });
  app2.delete("/api/payments/:id", async (req, res) => {
    try {
      const paymentId = Number(req.params.id);
      const deleted = await deletePaymentRecord(paymentId);
      await notifyMutated(
        `Quittance supprim\xE9e : ${deleted?.receiptNumber || `#${paymentId}`}`
      );
      res.json({ success: true, deleted });
    } catch (error) {
      res.status(500).json({ error: error.message || "Erreur suppression quittance" });
    }
  });
  app2.delete("/api/accounting-months/:periodMonth", async (req, res) => {
    try {
      const periodMonth = decodeURIComponent(req.params.periodMonth);
      const updatedStore = await deleteAccountingMonthEntry(periodMonth);
      await notifyMutated(`Mois comptable supprim\xE9 : ${periodMonth}`);
      res.json({ success: true, templates: updatedStore });
    } catch (error) {
      res.status(500).json({ error: error.message || "Erreur suppression mois comptable" });
    }
  });
  app2.get("/api/public/reports/financial/pdf", async (req, res) => {
    try {
      const [data] = await Promise.all([
        getAllDashboardData(),
        initTemplatesStoreFromDb()
      ]);
      const granularity = req.query.granularity === "daily" || req.query.granularity === "annual" ? req.query.granularity : "monthly";
      const landlordId = req.query.landlordId && req.query.landlordId !== "all" ? Number(req.query.landlordId) : "all";
      const download = req.query.download === "1";
      streamFinancialReportPdf(
        res,
        {
          granularity,
          landlordId,
          ...data
        },
        !download
      );
    } catch (error) {
      console.error("Error streaming financial report PDF:", error);
      res.status(500).send("Erreur lors de la g\xE9n\xE9ration du rapport financier PDF.");
    }
  });
  app2.get("/api/public/user-guide/pdf", async (req, res) => {
    try {
      await initTemplatesStoreFromDb();
      const download = req.query.download === "1";
      streamUserGuidePdf(res, !download);
    } catch (error) {
      console.error("Error streaming user guide PDF:", error);
      res.status(500).send("Erreur lors de la g\xE9n\xE9ration du guide d'utilisation PDF.");
    }
  });
  return app2;
}

// src/server/vercel-entry.ts
dotenv.config();
var app = createGimmoApiApp({
  serverlessMode: true
});
var vercel_entry_default = app;
export {
  vercel_entry_default as default
};
