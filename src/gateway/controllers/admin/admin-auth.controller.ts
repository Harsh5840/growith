import { NextFunction, Request, Response } from 'express';
import { AdminAuthService } from '../../../modules/admin/application/services/admin-auth.service';
import { 
  AdminRegisterRequestDto, 
  AdminLoginRequestDto,
  AdminForgotPasswordDto,
  AdminResetPasswordDto,
  AdminCreateUserDto,
  AdminEditUserDto,
  AdminListUsersQueryDto
} from '../../../modules/admin/application/dtos/admin-auth.dto';
import { successResponse } from '../../../shared/http/api-response';
import { AuthRequest } from '../../../types/auth-request';

export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as AdminRegisterRequestDto;
      const data = await this.adminAuthService.register(input);
      res.status(201).json(successResponse(201, 'Admin registered successfully', data));
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as AdminLoginRequestDto;
      const data = await this.adminAuthService.login(input);
      res.json(successResponse(200, 'Admin login successful', data));
    } catch (error) {
      next(error);
    }
  };

  me = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await this.adminAuthService.me(req.user!.userId);
      res.json(successResponse(200, 'Admin profile retrieved', { user }));
    } catch (error) {
      next(error);
    }
  };

  listUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const queryParams: AdminListUsersQueryDto = {
        search: req.query.search as string,
        kycStatus: req.query.kycStatus as string,
      };
      
      const users = await this.adminAuthService.listUsers(queryParams);
      res.json(successResponse(200, 'Users retrieved successfully', { users }));
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as AdminForgotPasswordDto;
      await this.adminAuthService.forgotPassword(input);
      res.json(successResponse(200, 'If an account exists, a reset code has been sent', null));
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as AdminResetPasswordDto;
      await this.adminAuthService.resetPassword(input);
      res.json(successResponse(200, 'Password reset successfully', null));
    } catch (error) {
      next(error);
    }
  };

  createUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const input = req.body as AdminCreateUserDto;
      const user = await this.adminAuthService.createUser(input);
      res.status(201).json(successResponse(201, 'User created successfully', { user }));
    } catch (error) {
      next(error);
    }
  };

  getUserById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await this.adminAuthService.getUserById(id);
      res.json(successResponse(200, 'User retrieved successfully', { user }));
    } catch (error) {
      next(error);
    }
  };

  editUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const input = req.body as AdminEditUserDto;
      await this.adminAuthService.editUser(id, input);
      res.json(successResponse(200, 'User updated successfully', null));
    } catch (error) {
      next(error);
    }
  };

  deleteUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await this.adminAuthService.deleteUser(id);
      res.json(successResponse(200, 'User deleted successfully', null));
    } catch (error) {
      next(error);
    }
  };
}
