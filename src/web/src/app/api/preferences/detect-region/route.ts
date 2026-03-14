import { type NextRequest, NextResponse } from "next/server";

const REGION_LABELS: Record<string, string> = {
  "northern-us-canada": "Northern US / Canada",
  "eastern-us": "Eastern US",
  "southern-us": "Southern US",
  "western-us": "Western US / Pacific",
  "western-europe": "Western Europe",
  mediterranean: "Mediterranean",
  "east-asia": "East Asia",
  "south-asia": "South Asia",
  "australia-nz": "Australia / NZ",
  "southern-hemisphere": "Southern hemisphere",
};

type GeoPayload = {
  country_code?: string;
  region_code?: string;
  error?: boolean;
};

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded
      .split(",")
      .map((value) => value.trim())
      .find(Boolean);
  }

  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    undefined
  );
}

function mapRegion(payload: GeoPayload) {
  const country = payload.country_code?.toUpperCase();
  const region = payload.region_code?.toUpperCase();

  if (!country) {
    return null;
  }

  if (country === "US") {
    if (
      [
        "ME",
        "NH",
        "VT",
        "MA",
        "RI",
        "CT",
        "NY",
        "NJ",
        "PA",
        "DE",
        "MD",
        "DC",
        "VA",
        "WV",
      ].includes(region ?? "")
    ) {
      return "eastern-us";
    }
    if (
      [
        "NC",
        "SC",
        "GA",
        "FL",
        "AL",
        "MS",
        "TN",
        "KY",
        "LA",
        "AR",
        "OK",
        "TX",
      ].includes(region ?? "")
    ) {
      return "southern-us";
    }
    if (
      [
        "CA",
        "OR",
        "WA",
        "AK",
        "HI",
        "NV",
        "AZ",
        "UT",
        "ID",
        "MT",
        "WY",
        "CO",
        "NM",
      ].includes(region ?? "")
    ) {
      return "western-us";
    }
    return "northern-us-canada";
  }

  if (country === "CA") return "northern-us-canada";
  if (
    [
      "GB",
      "IE",
      "FR",
      "DE",
      "NL",
      "BE",
      "LU",
      "CH",
      "AT",
      "DK",
      "SE",
      "NO",
      "FI",
    ].includes(country)
  ) {
    return "western-europe";
  }
  if (["ES", "PT", "IT", "GR", "HR", "SI", "MT", "CY"].includes(country)) {
    return "mediterranean";
  }
  if (["JP", "KR", "CN", "TW", "HK"].includes(country)) {
    return "east-asia";
  }
  if (["IN", "PK", "BD", "LK", "NP"].includes(country)) {
    return "south-asia";
  }
  if (["AU", "NZ"].includes(country)) {
    return "australia-nz";
  }
  if (["AR", "CL", "ZA", "UY"].includes(country)) {
    return "southern-hemisphere";
  }

  return null;
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_900);

  try {
    const url = ip
      ? `https://ipapi.co/${encodeURIComponent(ip)}/json/`
      : "https://ipapi.co/json/";
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Lookup failed");
    }

    const payload = (await response.json()) as GeoPayload;
    const region = payload.error ? null : mapRegion(payload);
    if (!region) {
      return NextResponse.json({
        region: null,
        error: "Could not detect region",
      });
    }

    return NextResponse.json({ region, label: REGION_LABELS[region] });
  } catch {
    return NextResponse.json({
      region: null,
      error: "Could not detect region",
    });
  } finally {
    clearTimeout(timeout);
  }
}
