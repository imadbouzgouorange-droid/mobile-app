import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Dimensions, Animated, Easing, TouchableWithoutFeedback } from 'react-native';
import { useState, useEffect, useRef } from 'react';

export default function App() {
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [towerBlocks, setTowerBlocks] = useState<Array<{id: number, position: number, color: string, width: number}>>([]);
  const [gameOver, setGameOver] = useState(false);
  const [isFalling, setIsFalling] = useState(false);
  const [fallingBlockData, setFallingBlockData] = useState<{position: number, color: string, width: number} | null>(null);
  const [currentBlockWidth, setCurrentBlockWidth] = useState(120); // Dynamic block width
  const [cameraOffset, setCameraOffset] = useState(0); // Camera offset for auto-centering

  const colors = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffc93c',
    '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'
  ];

  // Animation pour le mouvement des blocs
  const moveAnimation = useRef(new Animated.Value(0)).current;
  const initialBlockWidth = 180; // Largeur initiale des blocs (50% plus grande: 120 * 1.5)
  const blockHeight = 40; // Hauteur des blocs
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const startingHeight = 120; // Hauteur de départ des blocs
  const maxMoveDistance = Math.max(50, (screenWidth - currentBlockWidth) / 2); // Ensure minimum movement distance
  const [blockPosition, setBlockPosition] = useState(0); // Position actuelle du bloc
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const animationValueRef = useRef(new Animated.Value(0)).current;
  const fallingAnimation = useRef(new Animated.Value(0)).current;
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  // Calculate camera offset to keep the action centered
  const calculateCameraOffset = (level: number) => {
    // Start adjusting camera after level 8 for better gameplay
    if (level <= 8) return 0;
    
    // Move down by exactly one block height per level above 8
    const excessLevels = level - 8;
    
    // Positive translateY moves the tower DOWN (older blocks move down and out of view)
    return (excessLevels * blockHeight);
  };


  const handleStartGame = () => {
    setIsGameStarted(true);
    setCurrentLevel(0); // Start at level 0 for the first block
    setGameCompleted(false);
    setIsMoving(false);
    setIsFalling(false);
    setFallingBlockData(null);
    setCurrentBlockWidth(initialBlockWidth); // Reset to initial width
    setCameraOffset(0); // Reset camera position
    animationValueRef.setValue(0);
    moveAnimation.setValue(0);
    setBlockPosition(0);
    setGameOver(false);
    
    // Auto-place the first block in the center - level 0 with special color
    const firstBlock = {
      id: 0,
      position: 0, // Center position
      color: '#8b5cf6', // Special purple color for the foundation block
      width: initialBlockWidth
    };
    setTowerBlocks([firstBlock]);
    setCurrentLevel(1); // Move to level 1 for the next block
    
    // Start movement for the second block (actual level 1)
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
    
    // Initialiser les valeurs d'animation - commencer à droite
    animationValueRef.setValue(0);
    moveAnimation.setValue(maxMoveDistance); // Start from right side
    setBlockPosition(maxMoveDistance);
    
    // Créer une animation continue basée sur une fonction sinusoïdale
    const listener = animationValueRef.addListener(({ value }) => {
      // Convertir la valeur (0-1) en position sinusoïdale - commencer à droite
      const sineValue = Math.sin(value * Math.PI * 2 + Math.PI/2); // Phase shift to start from right
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

  // Calculer le chevauchement et la nouvelle taille du bloc
  const calculateBlockTrimming = (currentPosition: number, previousBlock: {position: number, width: number}) => {
    const currentLeft = currentPosition - currentBlockWidth / 2;
    const currentRight = currentPosition + currentBlockWidth / 2;
    const previousLeft = previousBlock.position - previousBlock.width / 2;
    const previousRight = previousBlock.position + previousBlock.width / 2;
    
    // Calculer la zone de chevauchement
    const overlapLeft = Math.max(currentLeft, previousLeft);
    const overlapRight = Math.min(currentRight, previousRight);
    
    // Vérifier s'il y a un chevauchement
    if (overlapLeft >= overlapRight) {
      return { hasOverlap: false, newWidth: 0, newPosition: 0 };
    }
    
    // Calculer la nouvelle largeur et position
    const newWidth = overlapRight - overlapLeft;
    const newPosition = (overlapLeft + overlapRight) / 2;
    
    return { hasOverlap: true, newWidth, newPosition };
  };

  // Animation de chute pour les parties extérieures du bloc
  const animateFallingParts = (blockPosition: number, blockColor: string, blockWidth: number) => {
    setIsFalling(true);
    setFallingBlockData({ position: blockPosition, color: blockColor, width: blockWidth });
    
    // Reset des animations
    fallingAnimation.setValue(startingHeight + (currentLevel * blockHeight));
    shakeAnimation.setValue(0);
    
    // Animation de chute
    const fallAnimation = Animated.timing(fallingAnimation, {
      toValue: 20, // Tombe jusqu'à la plateforme
      duration: 600,
      useNativeDriver: true,
    });
    
    // Animation de tremblement lors de l'impact
    const breakAnimation = Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 8,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -8,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 80,
        useNativeDriver: true,
      }),
    ]);
    
    // Lancer les animations en séquence
    Animated.sequence([fallAnimation, breakAnimation]).start(() => {
      setIsFalling(false);
      setFallingBlockData(null);
    });
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
      
      // Calculer le chevauchement avec le bloc précédent
      const previousBlock = towerBlocks[towerBlocks.length - 1];
      const trimResult = calculateBlockTrimming(currentBlockPosition, previousBlock);
      
        if (!trimResult.hasOverlap) {
          // Aucun chevauchement = le bloc tombe complètement = Game Over
          console.log(`Game Over: No overlap at level ${currentLevel}, position = ${currentBlockPosition}`);
          animateFallingParts(currentBlockPosition, colors[Math.max(0, (currentLevel - 1) % colors.length)], currentBlockWidth);
          setTimeout(() => setGameOver(true), 1000);
          return;
        }
      
      if (trimResult.newWidth <= 1) {
        // Largeur trop petite = Game Over
        console.log(`Game Over: Block width too small at level ${currentLevel}, width = ${trimResult.newWidth}`);
        setTimeout(() => setGameOver(true), 500);
        return;
      }
      
      // Il y a un chevauchement, ajouter la partie qui reste
      const newBlock = {
        id: currentLevel,
        position: trimResult.newPosition,
        color: colors[Math.max(0, (currentLevel - 1) % colors.length)], // -1 because level 1 should use colors[0]
        width: trimResult.newWidth
      };
      
        // Note: No falling animation for trimmed parts to keep UI clean
      
      setTowerBlocks([...towerBlocks, newBlock]);
      const newLevel = currentLevel + 1;
      setCurrentLevel(newLevel);
      
      // Mettre à jour la largeur pour le prochain bloc
      setCurrentBlockWidth(trimResult.newWidth);
      
      // Update camera offset to keep tower centered
      const newCameraOffset = calculateCameraOffset(newLevel);
      console.log(`Level ${newLevel}: Camera offset = ${newCameraOffset}, Block width = ${trimResult.newWidth}, Current block width = ${currentBlockWidth}`);
      setCameraOffset(newCameraOffset);
      
      // Redémarrer le mouvement pour le prochain bloc
      setTimeout(() => startBlockMovement(), 800);
    } else {
      // Démarrer le mouvement du bloc
      startBlockMovement();
    }
  };

  const handleResetGame = () => {
    setCurrentLevel(0); // Start at level 0 for the first block
    setGameCompleted(false);
    setIsMoving(false);
    setIsFalling(false);
    setFallingBlockData(null);
    setCurrentBlockWidth(initialBlockWidth); // Reset to initial width
    setCameraOffset(0); // Reset camera position
    if (animationRef.current) {
      animationRef.current.stop();
    }
    animationValueRef.setValue(0);
    moveAnimation.setValue(0);
    setGameOver(false);
    setBlockPosition(0);
    
    // Auto-place the first block in the center - level 0 with special color
    const firstBlock = {
      id: 0,
      position: 0, // Center position
      color: '#8b5cf6', // Special purple color for the foundation block
      width: initialBlockWidth
    };
    setTowerBlocks([firstBlock]);
    setCurrentLevel(1); // Move to level 1 for the next block
    
    // Start movement for the second block (actual level 1)
    setTimeout(() => startBlockMovement(), 1000);
  };

  const handleBackToMenu = () => {
    setIsGameStarted(false);
    setCurrentLevel(0);
    setGameCompleted(false);
    setIsMoving(false);
    setIsFalling(false);
    setFallingBlockData(null);
    setCurrentBlockWidth(initialBlockWidth);
    setCameraOffset(0); // Reset camera position
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
        <Text style={styles.subtitle}>
          Plus de bloc à placer ! La tour s'est effondrée quand le bloc est devenu trop petit !
        </Text>
        <Text style={styles.scoreText}>
          Tour finale: {towerBlocks.length - 1} niveaux • Taille finale: {Math.round((currentBlockWidth / initialBlockWidth) * 100)}%
        </Text>
        
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
        <View style={styles.gameInfo}>
          <Text style={styles.levelText}>Niveau: {currentLevel}</Text>
          <View style={styles.widthContainer}>
            <Text style={styles.widthText}>Taille: </Text>
            <View style={styles.widthBar}>
              <View style={[styles.widthFill, { width: `${Math.round((currentBlockWidth / initialBlockWidth) * 100)}%` }]} />
            </View>
            <Text style={styles.widthPercentage}>{Math.round((currentBlockWidth / initialBlockWidth) * 100)}%</Text>
          </View>
        </View>
      </View>

      {/* Zone de jeu cliquable */}
      <TouchableWithoutFeedback onPress={handleAddBlock}>
        <View style={[styles.gameArea, { transform: [{ translateY: cameraOffset }] }]}>
          <View style={styles.towerContainer}>
            {/* Ligne de départ visuelle */}
            <View style={styles.startingLine} />
            
            {/* Blocs empilés avec positionnement précis */}
            {towerBlocks.map((block, index) => (
              <View
                key={block.id}
                style={[
                  styles.block,
                  {
                    backgroundColor: block.color,
                    bottom: startingHeight + (index * blockHeight),
                    zIndex: towerBlocks.length - index,
                    left: screenWidth / 2 - block.width / 2 + block.position,
                    width: block.width,
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
                    backgroundColor: colors[Math.max(0, (currentLevel - 1) % colors.length)], // -1 because level 1 should use colors[0]
                    bottom: startingHeight + (currentLevel * blockHeight),
                    zIndex: 10,
                    left: screenWidth / 2 - currentBlockWidth / 2,
                    width: currentBlockWidth,
                    transform: [{ translateX: moveAnimation }],
                  }
                ]}
              />
            )}
            
            {/* Bloc qui tombe (animation de chute) */}
            {isFalling && fallingBlockData && (
              <Animated.View
                style={[
                  styles.fallingBlock,
                  {
                    backgroundColor: fallingBlockData.color,
                    left: screenWidth / 2 - fallingBlockData.width / 2 + fallingBlockData.position,
                    width: fallingBlockData.width,
                    zIndex: 15,
                    transform: [
                      { translateY: fallingAnimation },
                      { translateX: shakeAnimation }
                    ],
                  }
                ]}
              />
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
      
      <StatusBar style="auto" />
    </View>
  );
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
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
    backgroundColor: '#4ecdc4',
    paddingVertical: 18,
    paddingHorizontal: 36,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#4ecdc4',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  exitButton: {
    backgroundColor: '#ff6b6b',
    paddingVertical: 18,
    paddingHorizontal: 36,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#ff6b6b',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
    backgroundColor: '#1a1a2e',
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
  gameInfo: {
    alignItems: 'flex-end',
  },
  levelText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  widthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  widthText: {
    color: '#4ecdc4',
    fontSize: 14,
    fontWeight: '600',
  },
  widthBar: {
    width: 80,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  widthFill: {
    height: '100%',
    backgroundColor: '#4ecdc4',
    borderRadius: 4,
  },
  widthPercentage: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 35,
  },
  gameArea: {
    flex: 1,
    position: 'relative',
  },
  gameAreaActive: {
    backgroundColor: 'rgba(0, 210, 211, 0.1)',
  },
  towerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 50,
    position: 'relative',
  },
  startingLine: {
    position: 'absolute',
    bottom: 120, // Position de la ligne de départ (plus basse)
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#00d2d3',
    marginHorizontal: 40,
    borderRadius: 2,
    shadowColor: '#00d2d3',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  block: {
    height: 40,
    borderRadius: 0, // Perfectly rectangular
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  movingBlock: {
    height: 40,
    borderRadius: 0, // Perfectly rectangular
    position: 'absolute',
    shadowColor: '#ffffff',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 15,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  fallingBlock: {
    height: 40,
    borderRadius: 0, // Perfectly rectangular
    position: 'absolute',
    shadowColor: '#ff6b6b',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 107, 0.8)',
    opacity: 0.8,
  },
  scoreText: {
    color: '#fbbf24',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
});