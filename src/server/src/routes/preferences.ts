import { Hono, type Context } from "hono";
import { preferenceService, mealLogService } from "../services.js";

type GeoPayload = {
  country_code?: string;
  region_code?: string;
  error?: boolean;
};

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

function getClientIp(c: Context): string | undefined {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    return forwarded
      .split(",")
      .map((v) => v.trim())
      .find(Boolean);
  }
  return (
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-real-ip") ??
    undefined
  );
}

function mapRegion(payload: GeoPayload): string | null {
  const country = payload.country_code?.toUpperCase();
  const region = payload.region_code?.toUpperCase();
  if (!country) return null;

  if (country === "US") {
    if (["ME","NH","VT","MA","RI","CT","NY","NJ","PA","DE","MD","DC","VA","WV"].includes(region ?? "")) {
      return "eastern-us";
    }
    if (["NC","SC","GA","FL","AL","MS","TN","KY","LA","AR","OK","TX"].includes(region ?? "")) {
      return "southern-us";
    }
    if (["CA","OR","WA","AK","HI","NV","AZ","UT","ID","MT","WY","CO","NM"].includes(region ?? "")) {
      return "western-us";
    }
    return "northern-us-canada";
  }
  if (country === "CA") return "northern-us-canada";
  if (["GB","IE","FR","DE","NL","BE","LU","CH","AT","DK","SE","NO","FI"].includes(country)) return "western-europe";
  if (["ES","PT","IT","GR","HR","SI","MT","CY"].includes(country)) return "mediterranean";
  if (["JP","KR","CN","TW","HK"].includes(country)) return "east-asia";
  if (["IN","PK","BD","LK","NP"].includes(country)) return "south-asia";
  if (["AU","NZ"].includes(country)) return "australia-nz";
  if (["AR","CL","ZA","UY"].includes(country)) return "southern-hemisphere";
  return null;
}

export const preferencesRoutes = new Hono();

preferencesRoutes.get("/preferences", async (c) => {
  const data = await preferenceService.getPreferences();
  return c.json({ data });
});

preferencesRoutes.patch("/preferences", async (c) => {
  try {
    const body = await c.req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Expected a JSON object payload");
    }
    const data = await preferenceService.updatePreferences(body);
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to update preferences" },
      400
    );
  }
});

preferencesRoutes.post("/preferences/reset", async (c) => {
  try {
    const data = await preferenceService.resetPreferences();
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to reset preferences" },
      400
    );
  }
});

preferencesRoutes.get("/preferences/detect-region", async (c) => {
  const ip = getClientIp(c);
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
    if (!response.ok) throw new Error("Lookup failed");
    const payload = (await response.json()) as GeoPayload;
    const region = payload.error ? null : mapRegion(payload);
    if (!region) return c.json({ region: null, error: "Could not detect region" });
    return c.json({ region, label: REGION_LABELS[region] });
  } catch {
    return c.json({ region: null, error: "Could not detect region" });
  } finally {
    clearTimeout(timeout);
  }
});

preferencesRoutes.get("/preferences/export", async (c) => {
  const [preferences, mealLogs] = await Promise.all([
    preferenceService.getPreferences(),
    mealLogService.listAll(),
  ]);

  const payload = JSON.stringify(
    { exportedAt: new Date().toISOString(), preferences, mealLogs },
    null,
    2
  );

  const fileName = `copilot-chef-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(payload, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
});
