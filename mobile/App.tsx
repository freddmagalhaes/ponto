import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  BackHandler,
  TouchableOpacity,
  TextInput,
  Platform,
  PermissionsAndroid,
  Alert
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';

export default function App() {
  // URL oficial de produção na Vercel (permite acesso em qualquer celular via 4G ou Wi-Fi)
  const defaultUrl = 'https://ponto-fredericos-projects-208d7188.vercel.app';

  const [currentUrl, setCurrentUrl] = useState(defaultUrl);
  const [inputUrl, setInputUrl] = useState(defaultUrl);
  const [showConfig, setShowConfig] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const webViewRef = useRef<WebView>(null);

  // Solicita permissão de geolocalização no Android nativo para o WebView
  useEffect(() => {
    const requestLocationPermission = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Permissão de Localização',
              message: 'O PontoApp precisa da sua localização para o registro correto de ponto.',
              buttonNeutral: 'Perguntar depois',
              buttonNegative: 'Cancelar',
              buttonPositive: 'OK',
            }
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.log('Permissão de localização negada no Android.');
          }
        } catch (err) {
          console.warn('Erro ao solicitar permissão de localização:', err);
        }
      }
    };

    requestLocationPermission();
  }, []);

  // Trata o botão Voltar físico do Android para navegar dentro do WebView
  useEffect(() => {
    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [canGoBack]);

  const handleReload = () => {
    setHasError(false);
    setErrorMessage('');
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  const handleSaveUrl = () => {
    let formatted = inputUrl.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = 'http://' + formatted;
    }
    setCurrentUrl(formatted);
    setShowConfig(false);
    setHasError(false);
  };

  const handleMessage = async (event: any) => {
    try {
      const rawData = event.nativeEvent.data;
      if (!rawData) return;
      const data = JSON.parse(rawData);

      if (data.type === 'DOWNLOAD_PDF') {
        const { filename, base64 } = data;
        const cleanBase64 = base64
          .replace(/^data:application\/pdf;filename=[^;]+;base64,/, '')
          .replace(/^data:application\/pdf;base64,/, '');
        const fileUri = `${FileSystem.documentDirectory}${filename}`;

        await FileSystem.writeAsStringAsync(fileUri, cleanBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Exportar Relatório de Ponto',
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Download Concluído', `Arquivo salvo em:\n${fileUri}`);
        }
      }
    } catch (err: any) {
      console.error('Erro ao exportar PDF no mobile:', err);
      Alert.alert('Erro ao exportar PDF', err?.message || 'Falha ao processar o arquivo PDF.');
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar style="auto" />

        {/* Barra superior de controle rápido (configuração de URL) */}
        {showConfig && (
          <View style={styles.configBar}>
            <TextInput
              style={styles.input}
              value={inputUrl}
              onChangeText={setInputUrl}
              placeholder="http://192.168.1.X:5173"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveUrl}>
              <Text style={styles.saveBtnText}>Carregar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowConfig(false)}>
              <Text style={styles.cancelBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* WebView principal */}
        {!hasError ? (
          <WebView
            ref={webViewRef}
            source={{ uri: currentUrl }}
            style={styles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            geolocationEnabled={true}
            allowFileAccess={true}
            allowUniversalAccessFromFileURLs={true}
            allowsBackForwardNavigationGestures={true}
            startInLoadingState={true}
            onMessage={handleMessage}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#16a34a" />
                <Text style={styles.loadingText}>Carregando PontoApp...</Text>
              </View>
            )}
            onNavigationStateChange={(navState) => {
              setCanGoBack(navState.canGoBack);
            }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              setHasError(true);
              setErrorMessage(nativeEvent.description || 'Não foi possível conectar ao servidor.');
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              if (nativeEvent.statusCode >= 400) {
                setHasError(true);
                setErrorMessage(`Erro HTTP ${nativeEvent.statusCode}`);
              }
            }}
          />
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Não foi possível carregar o sistema</Text>
            <Text style={styles.errorDescription}>
              Verifique se o servidor web Vite está rodando no computador com o comando:
            </Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>npm run dev -- --host</Text>
            </View>
            <Text style={styles.errorDetail}>URL tentada: {currentUrl}</Text>
            {errorMessage ? <Text style={styles.errorSubDetail}>{errorMessage}</Text> : null}

            <View style={styles.errorActions}>
              <TouchableOpacity style={styles.primaryButton} onPress={handleReload}>
                <Text style={styles.primaryButtonText}>Tentar Novamente</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowConfig(true)}>
                <Text style={styles.secondaryButtonText}>Alterar URL do Servidor</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  configBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelBtn: {
    paddingHorizontal: 10,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#6b7280',
    fontSize: 13,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDescription: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 12,
  },
  codeBox: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  codeText: {
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    fontWeight: '600',
  },
  errorDetail: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  errorSubDetail: {
    fontSize: 12,
    color: '#ef4444',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorActions: {
    width: '100%',
    maxWidth: 300,
    gap: 12,
    marginTop: 16,
  },
  primaryButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 14,
  },
});
