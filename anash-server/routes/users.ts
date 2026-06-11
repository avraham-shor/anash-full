import express from 'express';
import {
    getUsers,
    getUserById,
    getUserByFullName,
    getUserByPhoneNumber,
    getUsersByPlace,
    updatePasswordOrRole
} from '../controlers/user-controler.ts';

var router = express.Router();

/* GET users listing. */
router.get('/', getUsers);
router.get('/search/name', getUserByFullName);
router.get('/search/phone', getUserByPhoneNumber);
router.get('/search/place', getUsersByPlace);
router.put('/:id/password', updatePasswordOrRole);
router.get('/:id', getUserById);


export default router;
