import { RegisterInvestorUseCase } from '../modules/investor/application/use-cases/register-investor.usecase';
import { LoginInvestorUseCase } from '../modules/investor/application/use-cases/login-investor.usecase';
import { ValidateEmailUseCase } from '../modules/investor/application/use-cases/validate-email.usecase';
import { GoogleAuthUseCase } from '../modules/investor/application/use-cases/google-auth.usecase';
import { GetGoogleAuthUrlUseCase } from '../modules/investor/application/use-cases/get-google-auth-url.usecase';
import { InvestorAuthService } from '../modules/investor/application/services/investor-auth.service';
import { InMemoryInvestorAuthRepository } from '../modules/investor/infrastructure/in-memory-investor-auth.repository';
import { PrismaInvestorAuthRepository } from '../modules/investor/infrastructure/prisma-investor-auth.repository';
import { JwtTokenService } from '../shared/auth/jwt-token.service';
import { createAuthenticate } from '../shared/auth/jwt-auth.guard';
import { AuthController } from '../gateway/controllers/investor/auth.controller';

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

  return {
    authController,
    authenticate,
  };
};
