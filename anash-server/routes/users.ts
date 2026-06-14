import express from 'express';
import {
    getUsers,
    getUserById,
    getUserByFullName,
    getUserByPhoneNumber,
    getUsersByPlace,
    updateUserPassword,
    updateUserRole,
} from '../controllers/user-controller.ts';

const router = express.Router();

/* GET users listing. */
router.get('/', getUsers);
router.get('/search/name', getUserByFullName);
router.get('/search/phone', getUserByPhoneNumber);
router.get('/search/place', getUsersByPlace);
router.put('/:id/password', updateUserPassword);
router.put('/:id/role', updateUserRole);
router.get('/:id', getUserById);


export default router;
