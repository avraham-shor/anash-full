import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import cors from 'cors';
import 'dotenv/config';

import indexRouter from './routes/index.ts';
import usersRouter from './routes/users.ts';
import authRouter from './routes/auth.ts';
import pageNotFound from './routes/page-not-found.ts';
import { verifyToken } from './middleware/auth.ts';

var app = express();

// view engine setup
app.set('views', path.join(process.cwd(), 'views'));
app.set('view engine', 'pug');

app.use(cors());
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
app.use(function (err: any, req: any, res: any) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

export default app;
