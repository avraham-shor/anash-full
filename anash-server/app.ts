import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';

import indexRouter from './routes/index.ts';
import usersRouter from './routes/users.ts';
import authRouter from './routes/auth.ts';
import pageNotFound from './routes/page-not-found.ts';
import { verifyToken } from './middleware/auth.ts';

const app = express();

app.set('trust proxy', 1);

// view engine setup
app.set('views', path.join(process.cwd(), 'views'));
app.set('view engine', 'pug');

app.use(helmet({ contentSecurityPolicy: false }));

const corsOrigin = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : process.env.NODE_ENV !== 'production';
app.use(cors({ origin: corsOrigin, credentials: true }));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static('public'));

app.use('/', indexRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', verifyToken, usersRouter);
app.use('*', pageNotFound);

// error handler
app.use((err: Error & { status?: number }, req: Request, res: Response, _next: NextFunction) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

export default app;
