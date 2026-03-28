import { InvestorAuthUseCasePort } from '../../../../core/ports/inbound/investor-auth.usecase.port';
import { LoginRequestDto } from '../dtos/auth.dto';
import { AuthResponse } from '../models/auth-response.model';

export class LoginInvestorUseCase {
  constructor(private readonly authUseCase: InvestorAuthUseCasePort) {}

  execute(input: LoginRequestDto): Promise<AuthResponse> {
    return this.authUseCase.login(input);
  }
}
