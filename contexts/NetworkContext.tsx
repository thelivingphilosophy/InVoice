import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkContextType {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: string | null;
  isOffline: boolean;
  networkState: NetInfoState | null;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  isInternetReachable: null,
  connectionType: null,
  isOffline: false,
  networkState: null,
});

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

interface NetworkProviderProps {
  children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
  const [networkState, setNetworkState] = useState<NetInfoState | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);
  const [connectionType, setConnectionType] = useState<string | null>(null);

  useEffect(() => {
    // Get initial network state
    NetInfo.fetch().then((state) => {
      console.log('🌐 Initial network state:', state);
      updateNetworkState(state);
    });

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      console.log('🌐 Network state changed:', state);
      updateNetworkState(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const updateNetworkState = (state: NetInfoState) => {
    setNetworkState(state);
    setIsConnected(state.isConnected ?? false);
    setIsInternetReachable(state.isInternetReachable);
    setConnectionType(state.type);
  };

  const isOffline = !isConnected || isInternetReachable === false;

  const value: NetworkContextType = {
    isConnected,
    isInternetReachable,
    connectionType,
    isOffline,
    networkState,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};