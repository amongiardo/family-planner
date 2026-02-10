import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import prisma from '../prisma';
import { generateFamilyAuthCode } from '../utils/familyAuthCode';

interface OAuthProfile {
  id: string;
  displayName: string;
  emails?: Array<{ value: string }>;
  photos?: Array<{ value: string }>;
}

async function findOrCreateUser(
  provider: 'google' | 'github',
  profile: OAuthProfile,
  inviteToken?: string
) {
  const email = profile.emails?.[0]?.value;
  if (!email) {
    throw new Error('Email not provided by OAuth provider');
  }

  // Check if user exists
  let user = await prisma.user.findFirst({
    where: {
      oauthProvider: provider,
      oauthId: profile.id,
    },
  });

  if (user) {
    return user;
  }

  // Check for invite token
  let familyId: string | undefined;
  let role: 'admin' | 'member' = 'admin';

  if (inviteToken) {
    const invite = await prisma.familyInvite.findUnique({
      where: { token: inviteToken },
    });

    if (invite && !invite.usedAt && invite.expiresAt > new Date() && invite.email === email) {
      familyId = invite.familyId;
      role = 'member';

      // Mark invite as used
      await prisma.familyInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });
    }
  }

  // Create new family if no invite
  if (!familyId) {
    const family = await prisma.family.create({
      data: {
        name: `${profile.displayName}'s Family`,
        authCode: generateFamilyAuthCode(5),
      },
    });
    familyId = family.id;
  }

  // Create user
  user = await prisma.user.create({
    data: {
      familyId,
      email,
      name: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
      oauthProvider: provider,
      oauthId: profile.id,
      role,
    },
  });

  return user;
}

export function configurePassport() {
  // Serialize user to session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
      });
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Google Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`,
          passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            const inviteToken = req.session?.inviteToken;
            const user = await findOrCreateUser('google', profile as OAuthProfile, inviteToken);
            delete req.session?.inviteToken;
            done(null, user);
          } catch (error) {
            done(error as Error);
          }
        }
      )
    );
  }

  // GitHub Strategy
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          callbackURL: `${process.env.BACKEND_URL}/auth/github/callback`,
          passReqToCallback: true,
          scope: ['user:email'],
        },
        async (
          req: Express.Request,
          accessToken: string,
          refreshToken: string,
          profile: OAuthProfile,
          done: (error: Error | null, user?: any) => void
        ) => {
          try {
            const inviteToken = (req.session as any)?.inviteToken;
            const user = await findOrCreateUser('github', profile, inviteToken);
            delete (req.session as any)?.inviteToken;
            done(null, user);
          } catch (error) {
            done(error as Error);
          }
        }
      )
    );
  }
}

// Extend session type for invite token
declare module 'express-session' {
  interface SessionData {
    inviteToken?: string;
  }
}
