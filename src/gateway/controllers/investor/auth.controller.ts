import { NextFunction, Request, Response } from 'express';
import {
	GoogleAuthRequestDto,
	ForgotPasswordRequestDto,
	LoginRequestDto,
	RefreshTokenRequestDto,
	RegisterRequestDto,
	ResetPasswordRequestDto,
	ValidateEmailRequestDto,
} from '@modules/investor/application/dtos/auth.dto';
import { RegisterInvestorUseCase } from '../../../modules/investor/application/use-cases/register-investor.usecase';
import { LoginInvestorUseCase } from '../../../modules/investor/application/use-cases/login-investor.usecase';
import { ValidateEmailUseCase } from '../../../modules/investor/application/use-cases/validate-email.usecase';
import { GoogleAuthUseCase } from '../../../modules/investor/application/use-cases/google-auth.usecase';
import { GetGoogleAuthUrlUseCase } from '../../../modules/investor/application/use-cases/get-google-auth-url.usecase';
import { InvestorAuthService } from '../../../modules/investor/application/services/investor-auth.service';
import { successResponse } from '../../../shared/http/api-response';
import { AuthRequest } from '../../../types/auth-request';

export class AuthController {
	constructor(
		private readonly registerInvestorUseCase: RegisterInvestorUseCase,
		private readonly loginInvestorUseCase: LoginInvestorUseCase,
		private readonly validateEmailUseCase: ValidateEmailUseCase,
		private readonly googleAuthUseCase: GoogleAuthUseCase,
		private readonly getGoogleAuthUrlUseCase: GetGoogleAuthUrlUseCase,
		private readonly investorAuthService: InvestorAuthService,
	) {}

	register = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const input = req.body as RegisterRequestDto;
			const data = await this.registerInvestorUseCase.execute(input);
			res.status(201).json(successResponse(201, 'User registered successfully', data));
		} catch (error) {
			next(error);
		}
	};

	validateEmail = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const input = req.body as ValidateEmailRequestDto;
			const data = await this.validateEmailUseCase.execute(input);
			res.json(successResponse(200, data.message, data));
		} catch (error) {
			next(error);
		}
	};

	login = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const input = req.body as LoginRequestDto;
			const data = await this.loginInvestorUseCase.execute(input);
			res.json(successResponse(200, 'Login successful', data));
		} catch (error) {
			next(error);
		}
	};

	getGoogleAuthUrl = async (_req: Request, res: Response, next: NextFunction) => {
		try {
			const authUrl = await this.getGoogleAuthUrlUseCase.execute();
			res.json(successResponse(200, 'Google auth URL generated', { authUrl }));
		} catch (error) {
			next(error);
		}
	};

	googleAuth = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const input = req.body as GoogleAuthRequestDto;
			const data = await this.googleAuthUseCase.execute(input);
			res.json(successResponse(200, 'Google authentication successful', data));
		} catch (error) {
			next(error);
		}
	};

	googleCallback = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const code = req.query.code as string | undefined;
			if (!code) {
				res.status(400).json({
					success: false,
					statusCode: 400,
					message: 'No code provided',
				});
				return;
			}

			const data = await this.googleAuthUseCase.execute({ code });
			res.json(successResponse(200, 'Google authentication successful', data));
		} catch (error) {
			next(error);
		}
	};

	refreshToken = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const input = req.body as RefreshTokenRequestDto;
			const tokens = await this.investorAuthService.refreshToken(input);
			res.json(successResponse(200, 'Tokens refreshed successfully', { tokens }));
		} catch (error) {
			next(error);
		}
	};

	forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const input = req.body as ForgotPasswordRequestDto;
			await this.investorAuthService.sendPasswordResetEmail(input.email);
			res.json(successResponse(200, 'Password reset email sent'));
		} catch (error) {
			next(error);
		}
	};

	resetPassword = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const input = req.body as ResetPasswordRequestDto;
			await this.investorAuthService.resetPassword(input.token, input.newPassword, input.confirmPassword);
			res.json(successResponse(200, 'Password reset successfully'));
		} catch (error) {
			next(error);
		}
	};

	logout = async (_req: Request, res: Response) => {
		res.json(successResponse(200, 'Logout successful'));
	};

	me = async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const authReq = req as AuthRequest;
			const user = await this.investorAuthService.me(authReq.user!.userId);
			res.json(successResponse(200, 'User profile retrieved', { user }));
		} catch (error) {
			next(error);
		}
	};
}
