import type { Request, Response } from 'express';
import { STATUS_CODES } from '../../constants/statusCodes.js';
import { sendSuccess } from '../../utils/response.util.js';
import { userService } from './user.service.js';

export const userController = {
  /**
   * @swagger
   * /api/users:
   *   get:
   *     summary: Get all users
   *     tags: [Users]
   *     responses:
   *       200:
   *         description: List of users
   */
  async getUsers(_req: Request, res: Response): Promise<void> {
    const users = await userService.getAllUsers();
    sendSuccess(res, users);
  },

  /**
   * @swagger
   * /api/users:
   *   post:
   *     summary: Create user
   *     tags: [Users]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateUserRequest'
   *     responses:
   *       201:
   *         description: User created
   */
  async createUser(req: Request, res: Response): Promise<void> {
    const user = await userService.createUser(req.body);
    sendSuccess(res, user, STATUS_CODES.CREATED);
  },

  /**
   * @swagger
   * /api/users/{id}:
   *   get:
   *     summary: Get user by id
   *     tags: [Users]
   */
  async getUser(req: Request, res: Response): Promise<void> {
    const user = await userService.getUserById(Number(req.params.id));
    sendSuccess(res, user);
  },

  /**
   * @swagger
   * /api/users/{id}:
   *   put:
   *     summary: Update user by id
   *     tags: [Users]
   */
  async updateUser(req: Request, res: Response): Promise<void> {
    const user = await userService.updateUser(Number(req.params.id), req.body);
    sendSuccess(res, user);
  },

  /**
   * @swagger
   * /api/users/{id}:
   *   delete:
   *     summary: Delete user by id
   *     tags: [Users]
   */
  async deleteUser(req: Request, res: Response): Promise<void> {
    const user = await userService.deleteUser(Number(req.params.id));
    sendSuccess(res, user);
  }
};
