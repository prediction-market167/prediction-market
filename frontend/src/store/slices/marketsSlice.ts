import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { Market } from '@/types'

interface MarketsState {
  items: Market[]
  selectedCategory: string | null
}

const initialState: MarketsState = {
  items: [],
  selectedCategory: null,
}

const marketsSlice = createSlice({
  name: 'markets',
  initialState,
  reducers: {
    setMarkets(state, action: PayloadAction<Market[]>) {
      state.items = action.payload
    },
    setCategory(state, action: PayloadAction<string | null>) {
      state.selectedCategory = action.payload
    },
  },
})

export const { setMarkets, setCategory } = marketsSlice.actions
export default marketsSlice.reducer
