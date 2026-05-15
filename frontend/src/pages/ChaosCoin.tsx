import { CryptoTradingTerminal } from './CryptoTradingTerminal';
import { marketRoomApi } from '../services/api';

const chaosCoinApi = marketRoomApi.getCoin('chaos-coin');

export default function ChaosCoin() {
  return (
    <CryptoTradingTerminal
      api={chaosCoinApi}
      coinLabel="Chaos Coin"
      coinUnit="CHAO"
      socketEvent="market-room:chaos-coin:price-update"
      initialPrice={45}
    />
  );
}
