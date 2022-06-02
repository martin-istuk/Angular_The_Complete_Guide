import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import * as fromApp from "../store/app.reducer"
import * as AuthActions from "../auth/store/auth.actions"

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(
    private store: Store<fromApp.AppState>
  ) {}

  // user = new BehaviorSubject<User>(null);
  
  private tokenExpirationTimer: any;

  setLogoutTimer(expirationDuration: number) {
    console.log(expirationDuration);
    this.tokenExpirationTimer = setTimeout(() => {
      this.store.dispatch( new AuthActions.Logout() );
    }, expirationDuration);
  }

  clearLogoutTimer() {
    if (
      this.tokenExpirationTimer
    ) {
      clearTimeout(this.tokenExpirationTimer);
      this.tokenExpirationTimer = null;
    }
  }
}
