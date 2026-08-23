import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class InviteUserDto {
  @IsEmail({}, { message: 'Please provide a valid employee email.' })
  @IsNotEmpty({ message: 'Work email is required.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'First name is required.' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Last name is required.' })
  lastName: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsNotEmpty({ message: 'Role selection is required.' })
  roleId: string;

  @IsString()
  @IsOptional()
  outletId?: string;

  @IsString()
  @MinLength(8, { message: 'Password must contain at least 8 characters.' })
  @IsNotEmpty({ message: 'Password is required.' })
  password: string;

  @IsString()
  @IsOptional()
  confirmPassword?: string;
}
