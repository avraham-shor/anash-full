import express from 'express';
import createError from 'http-errors';
var router = express.Router();

router.use((req, res, next) => {
    next(createError(404));
});

export default router;