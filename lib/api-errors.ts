import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/authz";
import { ChaperoneRatioError } from "@/lib/chaperone";
import { WaiverError } from "@/lib/waivers";
import { ListingPublishError } from "@/lib/listings";

/**
 * Maps the domain errors thrown by lib/* enforcement functions (Section 7
 * rules) into the right HTTP status. Keeps API route handlers free of
 * repeated try/catch boilerplate.
 */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request body.", issues: err.flatten() }, { status: 400 });
  }
  if (err instanceof ChaperoneRatioError) {
    return NextResponse.json(
      { error: err.message, code: "CHAPERONE_RATIO_NOT_MET", requiredChaperones: err.requiredChaperones },
      { status: 422 },
    );
  }
  if (err instanceof WaiverError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
  }
  if (err instanceof ListingPublishError) {
    return NextResponse.json({ error: err.message, code: "LISTING_NOT_PUBLISHABLE", missingFields: err.missingFields }, { status: 422 });
  }

  console.error(err);
  return NextResponse.json({ error: "Internal server error." }, { status: 500 });
}
