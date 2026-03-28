import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterRequestDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password!: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword!: string;
}

export class LoginRequestDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class GoogleAuthRequestDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class RefreshTokenRequestDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ValidateEmailRequestDto {
  @IsEmail()
  email!: string;

  @IsIn(['signup', 'signin'])
  mode!: 'signup' | 'signin';

  @IsOptional()
  @IsString()
  password?: string;
}

export class ForgotPasswordRequestDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordRequestDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  newPassword!: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword!: string;
}
