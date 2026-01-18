export class CreateUserDto {
  name: string;
  email: string;
}

export class UpdateUserDto {
  name?: string;
  email?: string;
}
