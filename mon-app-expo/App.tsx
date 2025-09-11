import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Dimensions, Animated, Easing, TouchableWithoutFeedback } from 'react-native';
import { useState, useEffect, useRef } from 'react';

export default function App() {
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [towerBlocks, setTowerBlocks] = useState<Array<{id: number, position: number, color: string}>>([]);
  const [gameOver, setGameOver] = useState(false);
  const [strikes, setStrikes] = useState(0);
  const [isFalling, setIsFalling] = useState(false);
  const [fallingBlockData, setFallingBlockData] = useState<{position: number, color: string} | null>(null);
  
  const maxStrikes = 3;

  const colors = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffc93c',
    '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'
  ];

  // Animation pour le mouvement des blocs
  const moveAnimation = useRef(new Animated.Value(0)).current;
  const blockWidth = 120; // Largeur augmentée pour des blocs plus horizontaux
  const blockHeight = 40; // Hauteur augmentée pour une meilleure visibilité
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const startingHeight = 120; // Hauteur de départ des blocs
  const maxMoveDistance = (screenWidth - blockWidth) / 2;
  const [blockPosition, setBlockPosition] = useState(0); // Position actuelle du bloc
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const animationValueRef = useRef(new Animated.Value(0)).current;
  const fallingAnimation = useRef(new Animated.Value(0)).current;
  const shakeAnimation = useRef(new Animated.Value(0)).current;


  const handleStartGame = () => {
    setIsGameStarted(true);
    setCurrentLevel(0);
    setGameCompleted(false);
    setIsMoving(false);
    setStrikes(0);
    setIsFalling(false);
    setFallingBlockData(null);
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

  // Vérifier si le bloc touche le bloc précédent (même partiellement)
  const checkBlockOverlap = (currentPosition: number, previousPosition: number) => {
    const currentLeft = currentPosition - blockWidth / 2;
    const currentRight = currentPosition + blockWidth / 2;
    const previousLeft = previousPosition - blockWidth / 2;
    const previousRight = previousPosition + blockWidth / 2;
    
    // Vérifier s'il y a un chevauchement (même minimal)
    return !(currentRight <= previousLeft || currentLeft >= previousRight);
  };

  // Vérifier la stabilité simple: le centre du bloc supérieur doit être au-dessus du bloc inférieur
  const checkSimpleStability = (upperBlockPosition: number, lowerBlockPosition: number) => {
    const lowerBlockLeft = lowerBlockPosition - blockWidth / 2;
    const lowerBlockRight = lowerBlockPosition + blockWidth / 2;
    
    // Le centre du bloc supérieur doit être dans les limites du bloc inférieur
    return upperBlockPosition >= lowerBlockLeft && upperBlockPosition <= lowerBlockRight;
  };

  // Animation de chute et bris du bloc
  const animateBlockFall = (blockPosition: number, blockColor: string) => {
    setIsFalling(true);
    setFallingBlockData({ position: blockPosition, color: blockColor });
    
    // Reset des animations
    fallingAnimation.setValue(startingHeight + (currentLevel * blockHeight));
    shakeAnimation.setValue(0);
    
    // Animation de chute
    const fallAnimation = Animated.timing(fallingAnimation, {
      toValue: 20, // Tombe jusqu'à la plateforme
      duration: 800,
      useNativeDriver: true,
    });
    
    // Animation de tremblement lors de l'impact
    const breakAnimation = Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 5,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 100,
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
      
      // Pour le premier bloc, il peut être placé n'importe où sur la ligne
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
        // Vérifier si le bloc touche le bloc précédent
        const previousBlock = towerBlocks[towerBlocks.length - 1];
        const hasOverlap = checkBlockOverlap(currentBlockPosition, previousBlock.position);
        
        if (!hasOverlap) {
          // Aucun chevauchement = le bloc tombe complètement
          animateBlockFall(currentBlockPosition, colors[currentLevel]);
          const newStrikes = strikes + 1;
          setStrikes(newStrikes);
          
          if (newStrikes >= maxStrikes) {
            setTimeout(() => setGameOver(true), 1000); // Délai pour voir l'animation
          } else {
            setTimeout(() => startBlockMovement(), 1500); // Redémarrer après l'animation
          }
          return;
        }
        
        // Il y a un chevauchement, vérifier la stabilité simple (centre du bloc supérieur)
        const isStable = checkSimpleStability(currentBlockPosition, previousBlock.position);
        
        if (!isStable) {
          // Le centre du bloc supérieur est en dehors du bloc inférieur = bloc tombe
          animateBlockFall(currentBlockPosition, colors[currentLevel]);
          const newStrikes = strikes + 1;
          setStrikes(newStrikes);
          
          if (newStrikes >= maxStrikes) {
            setTimeout(() => setGameOver(true), 1000); // Délai pour voir l'animation
          } else {
            setTimeout(() => startBlockMovement(), 1500); // Redémarrer après l'animation
          }
          return;
        }
        
        // Bloc stable, l'ajouter à la tour
        const newBlock = {
          id: currentLevel,
          position: currentBlockPosition,
          color: colors[currentLevel % colors.length] // Cycle through colors
        };
        setTowerBlocks([...towerBlocks, newBlock]);
        setCurrentLevel(currentLevel + 1);
        
        // Redémarrer le mouvement pour le prochain bloc
        setTimeout(() => startBlockMovement(), 500);
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
    setStrikes(0);
    setIsFalling(false);
    setFallingBlockData(null);
    if (animationRef.current) {
      animationRef.current.stop();
    }
    animationValueRef.setValue(0);
    moveAnimation.setValue(0);
    setTowerBlocks([]);
    setGameOver(false);
    setBlockPosition(0);
    // Redémarrer le jeu automatiquement
    setTimeout(() => startBlockMovement(), 1000);
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
        <Text style={styles.subtitle}>
          Vous avez fait {maxStrikes} erreurs ! Les blocs se sont brisés sur la plateforme !
        </Text>
        <Text style={styles.scoreText}>
          Tour finale: {towerBlocks.length} blocs • Erreurs: {strikes}/{maxStrikes}
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
          <Text style={styles.levelText}>Niveau: {currentLevel + 1}</Text>
          <Text style={styles.strikesText}>
            Erreurs: {strikes}/{maxStrikes} {Array(maxStrikes - strikes).fill('❤️').join('')}{Array(strikes).fill('💔').join('')}
          </Text>
        </View>
      </View>

      {/* Zone de jeu cliquable */}
      <TouchableWithoutFeedback onPress={handleAddBlock}>
        <View style={[styles.gameArea, isMoving && styles.gameAreaActive]}>
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
                    backgroundColor: colors[currentLevel % colors.length],
                    bottom: startingHeight + (currentLevel * blockHeight),
                    zIndex: 10,
                    left: screenWidth / 2 - blockWidth / 2,
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
                    left: screenWidth / 2 - blockWidth / 2 + fallingBlockData.position,
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
  strikesText: {
    color: '#ffc93c',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
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
    width: 120,
    height: 40,
    borderRadius: 12,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    // Effet de profondeur moderne
    borderWidth: 0,
    // Effet de brillance
    overflow: 'hidden',
  },
  movingBlock: {
    width: 120,
    height: 40,
    borderRadius: 12,
    position: 'absolute',
    shadowColor: '#ffffff',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 20,
    // Effet de lueur pour le bloc en mouvement
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    overflow: 'hidden',
  },
  fallingBlock: {
    width: 120,
    height: 40,
    borderRadius: 12,
    position: 'absolute',
    shadowColor: '#ff6b6b',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 15,
    // Effet de cassure/bris
    borderWidth: 3,
    borderColor: 'rgba(255, 107, 107, 0.8)',
    opacity: 0.9,
  },
  scoreText: {
    color: '#fbbf24',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
});