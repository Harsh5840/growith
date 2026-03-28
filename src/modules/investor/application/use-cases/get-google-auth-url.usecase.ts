import { InvestorAuthUseCasePort } from '@core/ports/inbound/investor-auth.usecase.port';

export class GetGoogleAuthUrlUseCase {
  constructor(private readonly authUseCase: InvestorAuthUseCasePort) {}

  execute(): Promise<string> {
    return this.authUseCase.getGoogleAuthUrl();
  }
}
