import * as oidc from "openid-client";
import bcrypt from "bcryptjs";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetCurrentAuthUserResponse,
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  LogoutMobileSessionResponse,
} from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  type SessionData,
} from "../lib/auth";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "DerdliAsiq";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "ber200666";

export async function seedAdminUser() {
  try {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, ADMIN_USERNAME));

    if (!existing) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await db.insert(usersTable).values({
        username: ADMIN_USERNAME,
        displayName: "Admin",
        passwordHash: hash,
        isAdmin: true,
        isBanned: false,
      });
    } else if (!existing.passwordHash) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await db
        .update(usersTable)
        .set({ passwordHash: hash, isAdmin: true })
        .where(eq(usersTable.username, ADMIN_USERNAME));
    }
  } catch (err) {
    console.error("Failed to seed admin user:", err);
  }
}

const router: IRouter = Router();

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.post("/auth/local-login", async (req: Request, res: Response) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json({ error: "İstifadəçi adı və şifrə tələb olunur" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username));

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "İstifadəçi adı və ya şifrə yanlışdır" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "İstifadəçi adı və ya şifrə yanlışdır" });
      return;
    }

    if (user.isBanned) {
      res.status(403).json({ error: "Bu hesab bloklanmışdır" });
      return;
    }

    if (!user.isAdmin) {
      res.status(403).json({ error: "Bu giriş yalnız adminlər üçündür" });
      return;
    }

    const sessionData: SessionData = {
      user: {
        id: user.id,
        email: user.email ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        profileImageUrl: user.profileImageUrl ?? null,
        isAdmin: user.isAdmin,
        username: user.username ?? null,
        displayName: user.displayName ?? null,
        isBanned: user.isBanned,
      },
      access_token: "",
      localAdmin: true,
    };

    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Local login error");
    res.status(500).json({ error: "Daxili xəta" });
  }
});

router.get("/login", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;
  const returnTo = getSafeReturnTo(req.query.returnTo);

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  setOidcCookie(res, "code_verifier", codeVerifier);
  setOidcCookie(res, "nonce", nonce);
  setOidcCookie(res, "state", state);
  setOidcCookie(res, "return_to", returnTo);

  res.redirect(redirectTo.href);
});

router.get("/callback", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;

  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect("/api/login");
    return;
  }

  const returnTo = getSafeReturnTo(req.cookies?.return_to);

  res.clearCookie("code_verifier", { path: "/" });
  res.clearCookie("nonce", { path: "/" });
  res.clearCookie("state", { path: "/" });
  res.clearCookie("return_to", { path: "/" });

  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }

  const userData = {
    id: claims.sub as string,
    email: (claims.email as string) || null,
    firstName: (claims.first_name as string) || null,
    lastName: (claims.last_name as string) || null,
    profileImageUrl: (claims.profile_image_url || claims.picture) as string | null,
  };

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, userData.id));

  const [dbUser] = await db
    .insert(usersTable)
    .values({ ...userData, isAdmin: false })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { ...userData, updatedAt: new Date() },
    })
    .returning();

  const user = { ...dbUser, isAdmin: existing?.isAdmin ?? dbUser.isAdmin };

  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: {
      id: user.id,
      email: user.email ?? null,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      profileImageUrl: user.profileImageUrl ?? null,
      isAdmin: user.isAdmin,
      username: user.username ?? null,
      displayName: user.displayName ?? null,
      isBanned: user.isBanned,
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : (claims.exp as number | undefined),
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.redirect(returnTo);
});

router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  const session = sid ? (await import("../lib/auth").then(m => m.getSession(sid))) : null;

  await clearSession(res, sid);

  if (!session?.localAdmin) {
    try {
      const config = await getOidcConfig();
      const origin = getOrigin(req);
      const endSessionUrl = oidc.buildEndSessionUrl(config, {
        client_id: process.env.REPL_ID!,
        post_logout_redirect_uri: origin,
      });
      res.redirect(endSessionUrl.href);
      return;
    } catch {
      // fall through
    }
  }

  res.redirect("/");
});

router.post(
  "/mobile-auth/token-exchange",
  async (req: Request, res: Response) => {
    const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required parameters" });
      return;
    }

    const { code, code_verifier, redirect_uri, state, nonce } = parsed.data;

    try {
      const config = await getOidcConfig();

      const callbackUrl = new URL(redirect_uri);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", state);
      callbackUrl.searchParams.set("iss", ISSUER_URL);

      const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: code_verifier,
        expectedNonce: nonce ?? undefined,
        expectedState: state,
        idTokenExpected: true,
      });

      const claims = tokens.claims();
      if (!claims) {
        res.status(401).json({ error: "No claims in ID token" });
        return;
      }

      const userData = {
        id: claims.sub as string,
        email: (claims.email as string) || null,
        firstName: (claims.first_name as string) || null,
        lastName: (claims.last_name as string) || null,
        profileImageUrl: (claims.profile_image_url || claims.picture) as string | null,
      };

      const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, userData.id));

      const [dbUser] = await db
        .insert(usersTable)
        .values({ ...userData, isAdmin: false })
        .onConflictDoUpdate({
          target: usersTable.id,
          set: { ...userData, updatedAt: new Date() },
        })
        .returning();

      const user = { ...dbUser, isAdmin: existing?.isAdmin ?? dbUser.isAdmin };

      const now = Math.floor(Date.now() / 1000);
      const sessionData: SessionData = {
        user: {
          id: user.id,
          email: user.email ?? null,
          firstName: user.firstName ?? null,
          lastName: user.lastName ?? null,
          profileImageUrl: user.profileImageUrl ?? null,
          isAdmin: user.isAdmin,
          username: user.username ?? null,
          displayName: user.displayName ?? null,
          isBanned: user.isBanned,
        },
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : (claims.exp as number | undefined),
      };

      const sid = await createSession(sessionData);
      res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token: sid }));
    } catch (err) {
      req.log.error({ err }, "Mobile token exchange error");
      res.status(500).json({ error: "Token exchange failed" });
    }
  },
);

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

export default router;
