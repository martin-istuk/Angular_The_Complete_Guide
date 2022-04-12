import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { Actions, Effect, ofType } from "@ngrx/effects";
import { of } from "rxjs";
import { catchError, map, switchMap, tap } from "rxjs/operators";
import { environment } from "src/environments/environment";
import { AuthService } from "../auth.service";
import { User } from "../user.model";

import * as AuthActions from "./auth.actions";

export interface AuthResponseData {
  kind: string;
  idToken:	string;
  email:	string;
  refreshToken:	string;
  expiresIn:	string;
  localId:	string;
  registered?: boolean;
}

const handleAuth = (
  email: string,
  userId: string,
  token: string,
  expiresIn: number
) => {
  const expirationDate = new Date(
    new Date().getTime() + 1000 * expiresIn
  );

  const user = new User( email, userId, token, expirationDate );

  localStorage.setItem(
    "userData",
    JSON.stringify(user)
  );

  return new AuthActions.AuthSuccess( {
    email: email,
    userId: userId,
    token: token,
    expirationDate: expirationDate,
    redirect: true
  } );
};

const handleError = (errorRes: any) => {
  let errorMessage = "An unknown error occured.";
  
  if (!errorRes.error || !errorRes.error.error) {
    return of(
      new AuthActions.AuthFail(errorMessage)
    );
  }
  
  switch (errorRes.error.error.message) {
    case "EMAIL_EXISTS":
      errorMessage = "This email exists already.";
      break;
    case "EMAIL_NOT_FOUND":
      errorMessage = "This email is not registered.";
      break;
    case "INVALID_PASSWORD":
      errorMessage = "Wrong password.";
      break;
  }

  return of(
    new AuthActions.AuthFail(errorMessage)
  )
}

@Injectable()
export class AuthEffects {
  constructor(
    private actions: Actions,
    private http: HttpClient,
    private router: Router,
    private authService: AuthService
  ) {}

  @Effect() authSignup = this.actions.pipe(
    ofType(AuthActions.SIGNUP_START),
    switchMap( (signupAction: AuthActions.SignupStart) => {
      return this.http.post<AuthResponseData>(
        'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + environment.firebaseAPIkey,
        {
          email: signupAction.payload.email,
          password: signupAction.payload.password,
          returnSecureToken: true
        }
      )
      .pipe(
        tap(resData => {
          this.authService.setLogoutTimer( 1000 * +resData.expiresIn )
        }),
        map(
          resData => {
            return handleAuth(
              resData.email,
              resData.localId,
              resData.idToken,
              +resData.expiresIn
            )
          }
        ), catchError(
          errorRes => {
            return handleError(
              errorRes
            )
          }
        )
      )
    } )
  );

  @Effect() authLogin = this.actions.pipe(
    ofType(AuthActions.LOGIN_START),
    switchMap( (authData: AuthActions.LoginStart) => {
      return this.http.post<AuthResponseData>(
        'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + environment.firebaseAPIkey,
        {
          email: authData.payload.email,
          password: authData.payload.password,
          returnSecureToken: true
        }
      )
      .pipe(
        tap(resData => {
          this.authService.setLogoutTimer( 1000 * +resData.expiresIn )
        }),
        map(
          resData => {
            return handleAuth(
              resData.email,
              resData.localId,
              resData.idToken,
              +resData.expiresIn
            )
          }
        ), catchError(
          errorRes => {
            return handleError(
              errorRes
            )
          }
        )
      )
    } )
  );

  @Effect( { dispatch: false } )
  authRedirect = this.actions.pipe(
    ofType(
      AuthActions.AUTH_SUCCESS
    ),
    tap( (authSuccessAction: AuthActions.AuthSuccess) => {
      if (authSuccessAction.payload.redirect) {
        this.router.navigate( [ "/" ] )
      }
    } )
  );

  @Effect()
  autoLogin = this.actions.pipe(
    ofType(
      AuthActions.AUTO_LOGIN
    ),
    map( () => {
      const userData: {
        email: string,
        id: string,
        _token: string,
        _tokenExpirationDate: string
      } = JSON.parse(localStorage.getItem("userData"));
      
      if (!userData) {
        return { type: "DUMMY" };
      }
  
      const loadedUser = new User(
        userData.email,
        userData.id,
        userData._token,
        new Date(userData._tokenExpirationDate)
      );
  
      if (loadedUser.token) {
        const expirationDuration = 
          new Date(userData._tokenExpirationDate).getTime() -
          new Date().getTime();
        this.authService.setLogoutTimer( expirationDuration );
        return new AuthActions.AuthSuccess({
          email: loadedUser.email,
          userId: loadedUser.id,
          token: loadedUser.token,
          expirationDate: new Date(userData._tokenExpirationDate),
          redirect: false
        });
        // const expirationDuration = 
        //   new Date(userData._tokenExpirationDate).getTime() -
        //   new Date().getTime();
        // this.autoLogout(expirationDuration);
      }
      return { type: "DUMMY" }
    } )
  );

  @Effect( { dispatch: false } )
  authLogout = this.actions.pipe(
    ofType(
      AuthActions.LOGOUT
    ),
    tap( () => {
      this.authService.clearLogoutTimer();
      localStorage.removeItem( "userData" );
      this.router.navigate( [ "/auth" ] );
    } )
  );
}