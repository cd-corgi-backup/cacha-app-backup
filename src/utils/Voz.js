import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capgo/capacitor-speech-recognition";

let recognitionWeb = null;
let activeListener = null;
let stateListener = null;
let debounceTimer = null;

// Función para limpiar listeners y temporizadores
const limpiarListeners = async () => {
  if (activeListener) {
    try {
      await activeListener.remove();
    } catch (e) {}
    activeListener = null;
  }
  if (stateListener) {
    try {
      await stateListener.remove();
    } catch (e) {}
    stateListener = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
};

// ==========================================
// 1. ESCUCHA CORTA (Para Ventas)
// ==========================================
export const iniciarEscucha = async (onResult, onEnd) => {
  if (Capacitor.isNativePlatform()) {
    try {
      const permiso = await SpeechRecognition.requestPermissions();
      if (permiso.speechRecognition !== "granted") {
        alert("Se necesita permiso de micrófono.");
        if (onEnd) onEnd();
        return;
      }

      // Limpiamos cualquier escucha anterior
      await SpeechRecognition.stop();
      await limpiarListeners();
      await SpeechRecognition.removeAllListeners();

      let textoAcumulado = "";
      let hasProcessed = false;

      const procesarYTerminar = async () => {
        if (hasProcessed) return;
        hasProcessed = true;

        if (debounceTimer) clearTimeout(debounceTimer);

        // Solo procesamos si hay un texto válido
        if (textoAcumulado.trim().length > 1) {
          onResult(textoAcumulado);
        }

        await SpeechRecognition.stop();
        if (onEnd) onEnd();
        await limpiarListeners();
      };

      // 1. Escuchar los resultados parciales (más estable en Android)
      activeListener = await SpeechRecognition.addListener(
        "partialResults",
        (data) => {
          if (data && data.matches && data.matches.length > 0) {
            textoAcumulado = data.matches[0];

            // DEBOUNCE: Reiniciar el temporizador cada vez que hables
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              // Si pasan 1.5 segundos sin hablar, procesamos la frase
              procesarYTerminar();
            }, 1500);
          }
        },
      );

      // 2. Escuchar si el sistema apaga el micrófono por su cuenta
      stateListener = await SpeechRecognition.addListener(
        "listeningState",
        (data) => {
          if (data.status === "stopped") {
            procesarYTerminar();
          }
        },
      );

      await SpeechRecognition.start({
        language: "es-CO",
        maxResults: 1,
        partialResults: true, // Usamos true para captar el texto mientras hablas
        popup: false,
      });
    } catch (error) {
      console.error("❌ Error Voz Android:", error);
      if (onEnd) onEnd();
    }
  } else {
    // --- WINDOWS / WEB ---
    const SpeechRecognitionWeb =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionWeb) {
      if (onEnd) onEnd();
      return alert("Reconocimiento de voz no soportado.");
    }

    recognitionWeb = new SpeechRecognitionWeb();
    recognitionWeb.lang = "es-CO";
    recognitionWeb.interimResults = false;

    recognitionWeb.onresult = (event) => {
      const texto = event.results[0][0].transcript;
      if (texto && texto.trim().length > 1) onResult(texto);
      recognitionWeb.stop();
    };

    recognitionWeb.onerror = () => {
      if (onEnd) onEnd();
    };
    recognitionWeb.onend = () => {
      if (onEnd) onEnd();
    };
    recognitionWeb.start();
  }
};

// ==========================================
// 2. DICTADO CONTINUO (Para Inventario)
// ==========================================
export const iniciarDictadoContinuo = async (onTextUpdate, onEnd) => {
  if (Capacitor.isNativePlatform()) {
    try {
      const permiso = await SpeechRecognition.requestPermissions();
      if (permiso.speechRecognition !== "granted") {
        alert("Se necesita permiso de micrófono.");
        if (onEnd) onEnd();
        return;
      }

      await SpeechRecognition.stop();
      await limpiarListeners();
      await SpeechRecognition.removeAllListeners();

      activeListener = await SpeechRecognition.addListener(
        "partialResults",
        (data) => {
          if (data && data.matches && data.matches.length > 0) {
            onTextUpdate(data.matches[0]);
          }
        },
      );

      await SpeechRecognition.start({
        language: "es-CO",
        maxResults: 5,
        partialResults: true,
        popup: false,
      });
    } catch (error) {
      console.error("❌ Error Dictado Android:", error);
      if (onEnd) onEnd();
    }
  } else {
    // --- WINDOWS / WEB ---
    const SpeechRecognitionWeb =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionWeb) {
      if (onEnd) onEnd();
      return alert("Reconocimiento de voz no soportado.");
    }

    recognitionWeb = new SpeechRecognitionWeb();
    recognitionWeb.lang = "es-CO";
    recognitionWeb.continuous = true;
    recognitionWeb.interimResults = true;

    let finalTranscript = "";
    recognitionWeb.onresult = (event) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal)
          finalTranscript += event.results[i][0].transcript + " ";
        else interimTranscript += event.results[i][0].transcript;
      }
      onTextUpdate(finalTranscript + interimTranscript);
    };

    recognitionWeb.onerror = () => {
      if (onEnd) onEnd();
    };
    recognitionWeb.onend = () => {
      if (onEnd) onEnd();
    };

    recognitionWeb.start();
  }
};

// ==========================================
// 3. DETENER ESCUCHA
// ==========================================
export const detenerEscucha = async () => {
  if (Capacitor.isNativePlatform()) {
    await SpeechRecognition.stop();
    await limpiarListeners();
  } else if (recognitionWeb) {
    recognitionWeb.stop();
    recognitionWeb = null;
  }
};
