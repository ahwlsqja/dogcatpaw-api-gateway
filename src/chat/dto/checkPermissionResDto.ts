import { IsBoolean, IsNotEmpty } from "class-validator";


export class CheckPermissionResDTO {
  @IsBoolean()
  @IsNotEmpty()
  canJoin: boolean;
}