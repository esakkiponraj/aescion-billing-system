import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsString({ message: 'Google ID token must be a string.' })
  @IsNotEmpty({ message: 'Google ID token is required.' })
  idToken: string;

  @IsString()
  @IsOptional()
  linkPassword?: string;
}
