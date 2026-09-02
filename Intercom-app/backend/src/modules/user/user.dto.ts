/**
 * @swagger
 * components:
 *   schemas:
 *     CreateUserRequest:
 *       type: object
 *       required: [email, password, name]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *         name:
 *           type: string
 *         role:
 *           type: string
 */
export type CreateUserDto = {
  email: string;
  password: string;
  name: string;
  role?: string;
};
