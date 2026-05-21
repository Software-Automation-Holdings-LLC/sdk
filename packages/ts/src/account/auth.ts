/**
 * `isa.account.*` re-exports the License-HMAC AuthContext shape from the
 * zyins facade. The account surface targets the same per-license endpoints
 * (branding, preferences, cases, email, reference-data) and shares the
 * same auth wire-up; redefining the type here would let the two surfaces
 * drift.
 *
 * When the License auth path is replaced by session credentials (#149), the
 * change lands in `zyins/auth.ts` and propagates here unchanged.
 */

export { type AuthContext, isAuthContext } from '../zyins/auth';
