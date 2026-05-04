import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import marketsReducer from './slices/marketsSlice'
import walletReducer from './slices/walletSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    markets: marketsReducer,
    wallet: walletReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
