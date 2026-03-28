import { InvestorAuthUseCasePort } from '../../../../core/ports/inbound/investor-auth.usecase.port';
import { RegisterRequestDto } from '../dtos/auth.dto';
import { AuthResponse } from '../models/auth-response.model';

export class RegisterInvestorUseCase {
	constructor(private readonly authUseCase: InvestorAuthUseCasePort) {}

	execute(input: RegisterRequestDto): Promise<AuthResponse> {
		return this.authUseCase.register(input);
	}
}
