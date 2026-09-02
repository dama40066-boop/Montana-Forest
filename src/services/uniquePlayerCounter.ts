import {
  signInAnonymously,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Unsubscribe
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, validateFirestoreConnection } from './firebase';

export interface UniquePlayerCounterState {
  totalUniquePlayers: number;
  isRegistered: boolean;
  currentUserUid: string | null;
  isLoading: boolean;
  error: string | null;
}

export type CounterCallback = (state: UniquePlayerCounterState) => void;

/**
 * Privacy-Preserving Unique Player Counter Service
 * 
 * Features:
 * - Uses Firebase Anonymous Authentication to provide each player with a private, persistent anonymous UID.
 * - Stores UID strictly once in /registered_players/{uid}.
 * - Never stores or requests IP addresses, device fingerprints, cookies, names, or emails.
 * - Transactionally increments /stats/player_counter by +1 only upon first registration.
 * - Subscribes in real-time to the global unique player count via Firestore snapshots.
 */
class UniquePlayerCounterService {
  private currentState: UniquePlayerCounterState = {
    totalUniquePlayers: 1,
    isRegistered: false,
    currentUserUid: null,
    isLoading: true,
    error: null,
  };

  private listeners: Set<CounterCallback> = new Set();
  private unsubscribeSnapshot: Unsubscribe | null = null;
  private unsubscribeAuth: Unsubscribe | null = null;
  private isRegistering = false;
  private initialized = false;

  public initialize(callback?: CounterCallback): () => void {
    if (callback) {
      this.listeners.add(callback);
      callback(this.currentState);
    }

    if (this.initialized) {
      return () => {
        if (callback) this.listeners.delete(callback);
      };
    }
    this.initialized = true;

    // 1. Check connection health quietly in background
    validateFirestoreConnection().catch(() => {});

    // 2. Set up real-time listener for the global counter
    this.subscribeToCounter();

    // 3. Authenticate player anonymously and perform one-time registration check
    this.setupAuthAndRegistration();

    return () => {
      if (callback) this.listeners.delete(callback);
    };
  }

  private updateState(partial: Partial<UniquePlayerCounterState>) {
    this.currentState = { ...this.currentState, ...partial };
    this.notifyListeners();
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.currentState);
      } catch (err) {
        console.error('Error notifying counter listener:', err);
      }
    }
  }

  private subscribeToCounter() {
    if (!db) {
      this.updateState({
        totalUniquePlayers: 1,
        isLoading: false,
      });
      return;
    }

    try {
      const counterDocRef = doc(db, 'stats', 'player_counter');

      this.unsubscribeSnapshot = onSnapshot(
        counterDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const count = typeof data.totalUniquePlayers === 'number' ? data.totalUniquePlayers : 1;
            this.updateState({
              totalUniquePlayers: Math.max(1, count),
              isLoading: false,
              error: null,
            });
          } else {
            // Document not yet created; will be initialized on first player registration
            this.updateState({
              totalUniquePlayers: 1,
              isLoading: false,
            });
          }
        },
        (error) => {
          console.warn('UniquePlayerCounter onSnapshot notice:', error.message);
          this.updateState({
            totalUniquePlayers: Math.max(1, this.currentState.totalUniquePlayers),
            isLoading: false,
            error: null,
          });
        }
      );
    } catch (e) {
      console.warn('Failed to subscribe to counter:', e);
      this.updateState({ isLoading: false });
    }
  }

  private setupAuthAndRegistration() {
    if (!auth) {
      this.updateState({ isLoading: false });
      return;
    }

    try {
      this.unsubscribeAuth = onAuthStateChanged(auth, async (user: User | null) => {
        if (user) {
          this.updateState({ currentUserUid: user.uid });
          await this.ensurePlayerRegistered(user.uid);
        } else {
          try {
            const credential = await signInAnonymously(auth!);
            this.updateState({ currentUserUid: credential.user.uid });
            await this.ensurePlayerRegistered(credential.user.uid);
          } catch (authError) {
            console.warn('Anonymous sign-in notice (offline mode active):', authError);
            this.updateState({
              isLoading: false,
              error: null,
            });
          }
        }
      });
    } catch (e) {
      console.warn('Auth setup notice:', e);
      this.updateState({ isLoading: false });
    }
  }

  private async ensurePlayerRegistered(uid: string): Promise<void> {
    if (!db || this.isRegistering || this.currentState.isRegistered) return;
    this.isRegistering = true;

    try {
      const playerDocRef = doc(db, 'registered_players', uid);
      const counterDocRef = doc(db, 'stats', 'player_counter');

      // Step A: Check if this player is already registered
      let alreadyRegistered = false;
      try {
        const playerSnap = await getDoc(playerDocRef);
        if (playerSnap.exists()) {
          alreadyRegistered = true;
        }
      } catch {
        // Offline or permissions
      }

      if (alreadyRegistered) {
        this.updateState({
          isRegistered: true,
          isLoading: false,
        });
        this.isRegistering = false;
        return;
      }

      // Step B: Atomically register player UID and increment global unique counter
      await runTransaction(db, async (transaction) => {
        const playerDoc = await transaction.get(playerDocRef);
        if (playerDoc.exists()) {
          return;
        }

        const counterDoc = await transaction.get(counterDocRef);

        transaction.set(playerDocRef, {
          uid: uid,
          registeredAt: serverTimestamp(),
        });

        if (counterDoc.exists()) {
          const prevCount = counterDoc.data()?.totalUniquePlayers || 0;
          transaction.update(counterDocRef, {
            totalUniquePlayers: prevCount + 1,
            updatedAt: serverTimestamp(),
          });
        } else {
          transaction.set(counterDocRef, {
            totalUniquePlayers: 1,
            updatedAt: serverTimestamp(),
          });
        }
      });

      this.updateState({
        isRegistered: true,
        isLoading: false,
      });
    } catch (err: unknown) {
      console.warn('Player registration notice (resilient mode):', err);
      this.updateState({
        isLoading: false,
      });
    } finally {
      this.isRegistering = false;
    }
  }

  public getState(): UniquePlayerCounterState {
    return this.currentState;
  }

  public cleanup() {
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
      this.unsubscribeSnapshot = null;
    }
    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
      this.unsubscribeAuth = null;
    }
    this.listeners.clear();
    this.initialized = false;
  }
}

export const uniquePlayerCounter = new UniquePlayerCounterService();
