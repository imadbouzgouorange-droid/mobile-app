import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Dimensions, Animated, Easing } from 'react-native';
import { useState, useEffect, useRef } from 'react';

export default function App() {
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [towerBlocks, setTowerBlocks] = useState<Array<{id: number, position: number, color: string}>>([]);
  const [gameOver, setGameOver] = useState(false);

  const colors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
    '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#84cc16'
  ];

  // Animation pour le mouvement des blocs
  const moveAnimation = useRef(new Animated.Value(0)).current;
  const blockWidth = 120; // Largeur augmentée pour des blocs plus horizontaux
  const blockHeight = 30; // Hauteur réduite pour des blocs horizontaux fins
  const screenWidth = Dimensions.get('window').width;
  const maxMoveDistance = (screenWidth - blockWidth) / 2;
  const [blockPosition, setBlockPosition] = useState(0); // Position actuelle du bloc
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const animationValueRef = useRef(new Animated.Value(0)).current;


  const handleStartGame = () => {
    setIsGameStarted(true);
    setCurrentLevel(0);
    setGameCompleted(false);
    setIsMoving(false);
    animationValueRef.setValue(0);
    moveAnimation.setValue(0);
    setBlockPosition(0);
    setTowerBlocks([]);
    setGameOver(false);
    // Démarrer automatiquement le mouvement du premier bloc
    setTimeout(() => startBlockMovement(), 1000);
  };

  const handleExitGame = () => {
    Alert.alert(
      'Quitter',
      'Êtes-vous sûr de vouloir quitter le jeu ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Quitter', style: 'destructive', onPress: () => {
          setIsGameStarted(false);
          setCurrentLevel(0);
          setGameCompleted(false);
        }}
      ]
    );
  };

  // Démarrer le mouvement du bloc avec mouvement fluide et consistant
  const startBlockMovement = () => {
    if (isMoving) return;
    
    setIsMoving(true);
    
    // Initialiser les valeurs d'animation
    animationValueRef.setValue(0);
    moveAnimation.setValue(0);
    setBlockPosition(0);
    
    // Créer une animation continue basée sur une fonction sinusoïdale
    const listener = animationValueRef.addListener(({ value }) => {
      // Convertir la valeur (0-1) en position sinusoïdale
      const sineValue = Math.sin(value * Math.PI * 2);
      const position = sineValue * maxMoveDistance;
      
      // Mettre à jour la position du bloc
      moveAnimation.setValue(position);
      setBlockPosition(position);
    });
    
    // Créer une animation continue qui fait une rotation complète toutes les 4 secondes
    const animation = Animated.loop(
      Animated.timing(animationValueRef, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: false, // On doit utiliser false car on fait des calculs manuels
      }),
      { resetBeforeIteration: true }
    );
    
    animationRef.current = animation;
    animation.start();
    
    // Stocker le listener pour le nettoyer plus tard
    (animation as any).listener = listener;
  };

  // Vérifier si le bloc est bien placé (collision avec le bloc précédent)
  const checkBlockPlacement = (currentPosition: number, previousPosition: number) => {
    const tolerance = 30; // Tolérance de placement (en pixels)
    return Math.abs(currentPosition - previousPosition) <= tolerance;
  };

  const handleAddBlock = () => {
    if (isMoving) {
      // Arrêter le mouvement et vérifier le placement
      if (animationRef.current) {
        animationRef.current.stop();
        // Nettoyer le listener
        if ((animationRef.current as any).listener) {
          animationValueRef.removeListener((animationRef.current as any).listener);
        }
      }
      moveAnimation.stopAnimation();
      setIsMoving(false);
      
      // Obtenir la position actuelle du bloc
      const currentBlockPosition = blockPosition;
      
      // Pour le premier bloc, pas de vérification de collision
      if (currentLevel === 0) {
        const newBlock = {
          id: currentLevel,
          position: currentBlockPosition,
          color: colors[currentLevel]
        };
        setTowerBlocks([newBlock]);
        setCurrentLevel(1);
        // Redémarrer le mouvement pour le prochain bloc
        setTimeout(() => startBlockMovement(), 500);
      } else {
        // Vérifier la collision avec le bloc précédent
        const previousBlock = towerBlocks[towerBlocks.length - 1];
        const isWellPlaced = checkBlockPlacement(currentBlockPosition, previousBlock.position);
        
        if (isWellPlaced) {
          // Bloc bien placé, l'ajouter à la tour
          const newBlock = {
            id: currentLevel,
            position: currentBlockPosition,
            color: colors[currentLevel]
          };
          setTowerBlocks([...towerBlocks, newBlock]);
          
          if (currentLevel < 9) {
            setCurrentLevel(currentLevel + 1);
            // Redémarrer le mouvement pour le prochain bloc
            setTimeout(() => startBlockMovement(), 500);
          } else {
            setGameCompleted(true);
          }
        } else {
          // Bloc mal placé, le faire disparaître et casser la tour
          setGameOver(true);
        }
      }
    } else {
      // Démarrer le mouvement du bloc
      startBlockMovement();
    }
  };

  const handleResetGame = () => {
    setCurrentLevel(0);
    setGameCompleted(false);
    setIsMoving(false);
    if (animationRef.current) {
      animationRef.current.stop();
    }
    animationValueRef.setValue(0);
    moveAnimation.setValue(0);
    setTowerBlocks([]);
    setGameOver(false);
    setBlockPosition(0);
  };

  const handleBackToMenu = () => {
    setIsGameStarted(false);
    setCurrentLevel(0);
    setGameCompleted(false);
    setIsMoving(false);
    if (animationRef.current) {
      animationRef.current.stop();
    }
    animationValueRef.setValue(0);
    moveAnimation.setValue(0);
    setTowerBlocks([]);
    setGameOver(false);
    setBlockPosition(0);
  };

  // Écran de menu principal
  if (!isGameStarted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🎮 Mon Jeu</Text>
        <Text style={styles.subtitle}>Construisez une tour de 10 blocs !</Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.startButton} onPress={handleStartGame}>
            <Text style={styles.buttonText}>START</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.exitButton} onPress={handleExitGame}>
            <Text style={styles.buttonText}>EXIT</Text>
          </TouchableOpacity>
        </View>
        
        <StatusBar style="auto" />
      </View>
    );
  }

  // Écran de game over
  if (gameOver) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>💥 Game Over !</Text>
        <Text style={styles.subtitle}>Le bloc s'est cassé ! Essayez de mieux viser !</Text>
        <Text style={styles.scoreText}>Score: {towerBlocks.length} blocs</Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.startButton} onPress={handleResetGame}>
            <Text style={styles.buttonText}>REJOUER</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.exitButton} onPress={handleBackToMenu}>
            <Text style={styles.buttonText}>MENU</Text>
          </TouchableOpacity>
        </View>
        
        <StatusBar style="auto" />
      </View>
    );
  }

  // Écran de fin de jeu
  if (gameCompleted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🎉 Félicitations !</Text>
        <Text style={styles.subtitle}>Vous avez construit une tour de 10 blocs !</Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.startButton} onPress={handleResetGame}>
            <Text style={styles.buttonText}>REJOUER</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.exitButton} onPress={handleBackToMenu}>
            <Text style={styles.buttonText}>MENU</Text>
          </TouchableOpacity>
        </View>
        
        <StatusBar style="auto" />
      </View>
    );
  }

  // Écran de jeu
  return (
    <View style={styles.gameContainer}>
      <View style={styles.gameHeader}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackToMenu}>
          <Text style={styles.backButtonText}>← Menu</Text>
        </TouchableOpacity>
        <Text style={styles.levelText}>Niveau: {currentLevel + 1}/10</Text>
      </View>

      <View style={styles.towerContainer}>
        {/* Blocs empilés avec positionnement précis */}
        {towerBlocks.map((block, index) => (
          <View
            key={block.id}
            style={[
              styles.block,
              {
                backgroundColor: block.color,
                bottom: index * blockHeight,
                zIndex: towerBlocks.length - index,
                left: screenWidth / 2 - blockWidth / 2 + block.position,
              }
            ]}
          />
        ))}
        
        {/* Bloc en mouvement (si en cours) */}
        {isMoving && (
          <Animated.View
            style={[
              styles.movingBlock,
              {
                backgroundColor: colors[currentLevel],
                bottom: currentLevel * blockHeight,
                zIndex: 10,
                left: screenWidth / 2 - blockWidth / 2,
                transform: [{ translateX: moveAnimation }],
              }
            ]}
          />
        )}
      </View>

      <View style={styles.gameControls}>
        <TouchableOpacity 
          style={[styles.addBlockButton, isMoving && styles.addBlockButtonActive]} 
          onPress={handleAddBlock}
        >
          <Text style={styles.buttonText}>
            {isMoving ? 'Placer le bloc' : 'Ajouter un bloc'}
          </Text>
        </TouchableOpacity>
      </View>
      
      <StatusBar style="auto" />
    </View>
  );
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 40,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
    gap: 16,
  },
  startButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  exitButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
  // Styles pour l'écran de jeu
  gameContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButton: {
    backgroundColor: '#374151',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  levelText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  towerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 100,
    position: 'relative',
  },
  block: {
    width: 120,
    height: 30,
    borderRadius: 8,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#ffffff',
    // Effet 3D avec gradient simulé
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderTopColor: '#ffffff',
    borderLeftColor: '#ffffff',
    borderRightColor: '#1f2937',
    borderBottomColor: '#1f2937',
  },
  movingBlock: {
    width: 120,
    height: 30,
    borderRadius: 8,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 2,
    borderColor: '#ffffff',
    // Effet 3D plus prononcé pour le bloc en mouvement
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderTopColor: '#ffffff',
    borderLeftColor: '#ffffff',
    borderRightColor: '#111827',
    borderBottomColor: '#111827',
  },
  gameControls: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  addBlockButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addBlockButtonActive: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    transform: [{ scale: 1.05 }],
  },
  scoreText: {
    color: '#fbbf24',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
});