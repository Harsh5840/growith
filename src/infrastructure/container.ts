import { RegisterInvestorUseCase } from '../modules/investor/application/use-cases/register-investor.usecase';
import { LoginInvestorUseCase } from '../modules/investor/application/use-cases/login-investor.usecase';
import { ValidateEmailUseCase } from '../modules/investor/application/use-cases/validate-email.usecase';
import { GoogleAuthUseCase } from '../modules/investor/application/use-cases/google-auth.usecase';
import { GetGoogleAuthUrlUseCase } from '../modules/investor/application/use-cases/get-google-auth-url.usecase';
import { InvestorAuthService } from '../modules/investor/application/services/investor-auth.service';
import { KycService } from '../modules/investor/application/services/kyc.service';
import { InMemoryInvestorAuthRepository } from '../modules/investor/infrastructure/in-memory-investor-auth.repository';
import { PrismaInvestorAuthRepository } from '../modules/investor/infrastructure/prisma-investor-auth.repository';
import { JwtTokenService } from '../shared/auth/jwt-token.service';
import { createAuthenticate, createAuthenticateAdmin } from '../shared/auth/jwt-auth.guard';
import { AuthController } from '../gateway/controllers/investor/auth.controller';
import { KycController } from '../gateway/controllers/investor/kyc.controller';
import { PrismaAdminAuthRepository } from '../modules/admin/infrastructure/prisma-admin-auth.repository';
import { AdminAuthService } from '../modules/admin/application/services/admin-auth.service';
import { AdminKycService } from '../modules/admin/application/services/admin-kyc.service';
import { AdminAuthController } from '../gateway/controllers/admin/admin-auth.controller';
import { AdminKycController } from '../gateway/controllers/admin/admin-kyc.controller';
import { S3Adapter } from '../shared/storage/s3.adapter';

export const createContainer = () => {
  const useInMemory = process.env.USE_IN_MEMORY_AUTH === 'true' || process.env.NODE_ENV === 'test';
  const repository = useInMemory ? new InMemoryInvestorAuthRepository() : new PrismaInvestorAuthRepository();
  const jwtTokenService = new JwtTokenService();
  const authService = new InvestorAuthService(repository, jwtTokenService);

  const registerInvestorUseCase = new RegisterInvestorUseCase(authService);
  const loginInvestorUseCase = new LoginInvestorUseCase(authService);
  const validateEmailUseCase = new ValidateEmailUseCase(authService);
  const googleAuthUseCase = new GoogleAuthUseCase(authService);
  const getGoogleAuthUrlUseCase = new GetGoogleAuthUrlUseCase(authService);

  const authController = new AuthController(
    registerInvestorUseCase,
    loginInvestorUseCase,
    validateEmailUseCase,
    googleAuthUseCase,
    getGoogleAuthUrlUseCase,
    authService,
  );

  const authenticate = createAuthenticate(jwtTokenService);
  const authenticateAdmin = createAuthenticateAdmin(jwtTokenService);

  // --- S3 & KYC Dependencies ---
  const s3Adapter = new S3Adapter();
  const kycService = new KycService(s3Adapter);
  const kycController = new KycController(kycService);

  // --- Admin Dependencies ---
  const adminRepository = new PrismaAdminAuthRepository();
  const adminAuthService = new AdminAuthService(adminRepository, jwtTokenService);
  const adminAuthController = new AdminAuthController(adminAuthService);

  const adminKycService = new AdminKycService(s3Adapter);
  const adminKycController = new AdminKycController(adminKycService);

  return {
    authController,
    authenticate,
    kycController,
    adminAuthController,
    authenticateAdmin,
    adminKycController,
  };
};
