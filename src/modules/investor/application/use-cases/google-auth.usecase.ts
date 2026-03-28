import { InvestorAuthUseCasePort } from '../../../../core/ports/inbound/investor-auth.usecase.port';
import { GoogleAuthRequestDto } from '../dtos/auth.dto';
import { AuthResponse } from '../models/auth-response.model';

export class GoogleAuthUseCase {
  constructor(private readonly authUseCase: InvestorAuthUseCasePort) {}

  execute(input: GoogleAuthRequestDto): Promise<AuthResponse> {
    return this.authUseCase.googleAuth(input);
  }
}
