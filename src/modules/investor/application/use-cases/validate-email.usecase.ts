import { InvestorAuthUseCasePort } from '../../../../core/ports/inbound/investor-auth.usecase.port';
import { ValidateEmailRequestDto } from '../dtos/auth.dto';
import { ValidateEmailResponse } from '../models/auth-response.model';

export class ValidateEmailUseCase {
  constructor(private readonly authUseCase: InvestorAuthUseCasePort) {}

  execute(input: ValidateEmailRequestDto): Promise<ValidateEmailResponse> {
    return this.authUseCase.validateEmail(input);
  }
}
