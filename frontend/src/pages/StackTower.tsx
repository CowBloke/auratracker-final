import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { gsap, Power1 } from 'gsap';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameTopBar } from '@/components/game/GameTopBar';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { useHideGameLeaderboards } from '@/lib/game-preferences';
import { cn } from '@/lib/utils';

const GAME_TYPE = 'stack_tower';
const STAGE_WIDTH = 900;
const STAGE_HEIGHT = 560;
const TweenLite = gsap;

type StageState = 'loading' | 'playing' | 'ready' | 'ended' | 'resetting';

interface BlockReturn {
  placed?: THREE.Mesh;
  chopped?: THREE.Mesh;
  plane: 'x' | 'y' | 'z';
  direction: number;
  bonus?: boolean;
}

class Stage {
  private container: HTMLElement;
  private camera: THREE.OrthographicCamera;
  private cameraLookAt: THREE.Vector3;
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private light: THREE.DirectionalLight;
  private softLight: THREE.AmbientLight;
  private containerWidth: number = STAGE_WIDTH;
  private containerHeight: number = STAGE_HEIGHT;
  private resizeTimeout: number | null = null;

  constructor() {
    this.container = document.getElementById('game') as HTMLElement;

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });

    // Use default STAGE dimensions, will resize on first proper measurement
    this.renderer.setSize(STAGE_WIDTH, STAGE_HEIGHT);
    this.renderer.setClearColor('#D0CBC7', 1);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    const aspect = STAGE_WIDTH / STAGE_HEIGHT;
    const d = 20;
    this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, -100, 1000);
    this.camera.position.x = 2;
    this.camera.position.y = 2;
    this.camera.position.z = 2;
    this.cameraLookAt = new THREE.Vector3(0, 0, 0);
    this.camera.lookAt(this.cameraLookAt);

    this.light = new THREE.DirectionalLight(0xffffff, 0.5);
    this.light.position.set(0, 499, 0);
    this.scene.add(this.light);

    this.softLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.softLight);

    window.addEventListener('resize', this.onResize);
    // Do initial resize after small delay to allow layout to settle
    setTimeout(() => this.onResize(), 100);
  }

  setCamera(y: number, speed = 0.3) {
    TweenLite.to(this.camera.position, { duration: speed, y: y + 4, ease: Power1.easeInOut });
    TweenLite.to(this.cameraLookAt, {
      duration: speed,
      y,
      ease: Power1.easeInOut,
      onUpdate: () => {
        this.camera.lookAt(this.cameraLookAt);
      },
    });
  }

  onResize = () => {
    if (this.resizeTimeout !== null) {
      clearTimeout(this.resizeTimeout);
    }
    
    this.resizeTimeout = window.setTimeout(() => {
      if (this.container) {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width > 0 ? rect.width : this.containerWidth;
        const height = rect.height > 0 ? rect.height : this.containerHeight;
        
        this.containerWidth = width;
        this.containerHeight = height;
        
        this.renderer.setSize(width, height);
        
        const viewSize = 30;
        const aspect = width / height;
        this.camera.left = -aspect * viewSize / 2;
        this.camera.right = aspect * viewSize / 2;
        this.camera.top = viewSize / 2;
        this.camera.bottom = -viewSize / 2;
        this.camera.updateProjectionMatrix();
      }
      this.resizeTimeout = null;
    }, 150);
  };

  render = () => {
    this.renderer.render(this.scene, this.camera);
  };

  add = (elem: THREE.Object3D) => {
    this.scene.add(elem);
  };

  remove = (elem: THREE.Object3D) => {
    this.scene.remove(elem);
  };

  destroy = () => {
    window.removeEventListener('resize', this.onResize);
    if (this.resizeTimeout !== null) {
      clearTimeout(this.resizeTimeout);
    }
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  };
}

class Block {
  STATES = { ACTIVE: 'active', STOPPED: 'stopped', MISSED: 'missed' } as const;
  MOVE_AMOUNT = 12;

  dimension = { width: 0, height: 0, depth: 0 };
  position = { x: 0, y: 0, z: 0 };

  mesh: THREE.Mesh;
  state: string;
  index: number;
  speed: number;
  direction: number;
  colorOffset: number;
  color: THREE.ColorRepresentation;
  material: THREE.MeshToonMaterial;

  workingPlane: 'x' | 'z';
  workingDimension: 'width' | 'depth';

  targetBlock?: Block;

  constructor(block?: Block) {
    this.targetBlock = block;

    this.index = (this.targetBlock ? this.targetBlock.index : 0) + 1;
    this.workingPlane = this.index % 2 ? 'x' : 'z';
    this.workingDimension = this.index % 2 ? 'width' : 'depth';

    this.dimension.width = this.targetBlock ? this.targetBlock.dimension.width : 10;
    this.dimension.height = this.targetBlock ? this.targetBlock.dimension.height : 2;
    this.dimension.depth = this.targetBlock ? this.targetBlock.dimension.depth : 10;

    this.position.x = this.targetBlock ? this.targetBlock.position.x : 0;
    this.position.y = this.dimension.height * this.index;
    this.position.z = this.targetBlock ? this.targetBlock.position.z : 0;

    this.colorOffset = this.targetBlock ? this.targetBlock.colorOffset : Math.round(Math.random() * 100);

    if (!this.targetBlock) {
      this.color = 0x333344;
    } else {
      const offset = this.index + this.colorOffset;
      const r = Math.sin(0.3 * offset) * 55 + 200;
      const g = Math.sin(0.3 * offset + 2) * 55 + 200;
      const b = Math.sin(0.3 * offset + 4) * 55 + 200;
      this.color = new THREE.Color(r / 255, g / 255, b / 255);
    }

    this.state = this.index > 1 ? this.STATES.ACTIVE : this.STATES.STOPPED;

    this.speed = -0.1 - this.index * 0.005;
    if (this.speed < -4) {
      this.speed = -4;
    }
    this.direction = this.speed;

    const geometry = new THREE.BoxGeometry(this.dimension.width, this.dimension.height, this.dimension.depth);
    geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(this.dimension.width / 2, this.dimension.height / 2, this.dimension.depth / 2));
    this.material = new THREE.MeshToonMaterial({ color: this.color });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);

    if (this.state === this.STATES.ACTIVE) {
      this.position[this.workingPlane] = Math.random() > 0.5 ? -this.MOVE_AMOUNT : this.MOVE_AMOUNT;
      this.mesh.position[this.workingPlane] = this.position[this.workingPlane];
    }
  }

  reverseDirection() {
    this.direction = this.direction > 0 ? this.speed : Math.abs(this.speed);
  }

  place(): BlockReturn {
    this.state = this.STATES.STOPPED;

    if (!this.targetBlock) {
      return { plane: this.workingPlane, direction: this.direction };
    }

    let overlap = this.targetBlock.dimension[this.workingDimension] - Math.abs(this.position[this.workingPlane] - this.targetBlock.position[this.workingPlane]);

    const blocksToReturn: BlockReturn = {
      plane: this.workingPlane,
      direction: this.direction,
    };

    if (this.dimension[this.workingDimension] - overlap < 0.3) {
      overlap = this.dimension[this.workingDimension];
      blocksToReturn.bonus = true;
      this.position.x = this.targetBlock.position.x;
      this.position.z = this.targetBlock.position.z;
      this.dimension.width = this.targetBlock.dimension.width;
      this.dimension.depth = this.targetBlock.dimension.depth;
    }

    if (overlap > 0) {
      const choppedDimensions = { width: this.dimension.width, height: this.dimension.height, depth: this.dimension.depth };
      choppedDimensions[this.workingDimension] -= overlap;
      this.dimension[this.workingDimension] = overlap;

      const placedGeometry = new THREE.BoxGeometry(this.dimension.width, this.dimension.height, this.dimension.depth);
      placedGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(this.dimension.width / 2, this.dimension.height / 2, this.dimension.depth / 2));
      const placedMesh = new THREE.Mesh(placedGeometry, this.material);

      const choppedGeometry = new THREE.BoxGeometry(choppedDimensions.width, choppedDimensions.height, choppedDimensions.depth);
      choppedGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(choppedDimensions.width / 2, choppedDimensions.height / 2, choppedDimensions.depth / 2));
      const choppedMesh = new THREE.Mesh(choppedGeometry, this.material);

      const choppedPosition = {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z,
      };

      if (this.position[this.workingPlane] < this.targetBlock.position[this.workingPlane]) {
        this.position[this.workingPlane] = this.targetBlock.position[this.workingPlane];
      } else {
        choppedPosition[this.workingPlane] += overlap;
      }

      placedMesh.position.set(this.position.x, this.position.y, this.position.z);
      choppedMesh.position.set(choppedPosition.x, choppedPosition.y, choppedPosition.z);

      blocksToReturn.placed = placedMesh;
      if (!blocksToReturn.bonus) {
        blocksToReturn.chopped = choppedMesh;
      }
    } else {
      this.state = this.STATES.MISSED;
    }

    this.dimension[this.workingDimension] = overlap;

    return blocksToReturn;
  }

  tick() {
    if (this.state === this.STATES.ACTIVE) {
      const value = this.position[this.workingPlane];
      if (value > this.MOVE_AMOUNT || value < -this.MOVE_AMOUNT) {
        this.reverseDirection();
      }
      this.position[this.workingPlane] += this.direction;
      this.mesh.position[this.workingPlane] = this.position[this.workingPlane];
    }
  }
}

class Game {
  STATES = {
    LOADING: 'loading',
    PLAYING: 'playing',
    READY: 'ready',
    ENDED: 'ended',
    RESETTING: 'resetting',
  } as const;

  blocks: Block[] = [];
  state: StageState = this.STATES.LOADING;

  stage: Stage;
  newBlocks: THREE.Group;
  placedBlocks: THREE.Group;
  choppedBlocks: THREE.Group;

  scoreContainer: HTMLElement;
  mainContainer: HTMLElement;
  startButton: HTMLElement;
  instructions: HTMLElement;

  private rafId: number = 0;
  private onEnd?: (score: number) => void;
  private onScore?: (score: number) => void;
  private onStateChange?: (state: StageState) => void;

  private keydownHandler: (e: KeyboardEvent) => void;
  private clickHandler: () => void;
  private touchstartHandler: (e: TouchEvent) => void;

  constructor(options?: {
    onEnd?: (score: number) => void;
    onScore?: (score: number) => void;
    onStateChange?: (state: StageState) => void;
  }) {
    this.onEnd = options?.onEnd;
    this.onScore = options?.onScore;
    this.onStateChange = options?.onStateChange;

    this.stage = new Stage();

    this.mainContainer = document.getElementById('container') as HTMLElement;
    this.scoreContainer = document.getElementById('score') as HTMLElement;
    this.startButton = document.getElementById('start-button') as HTMLElement;
    this.instructions = document.getElementById('instructions') as HTMLElement;
    this.scoreContainer.innerHTML = '0';

    this.newBlocks = new THREE.Group();
    this.placedBlocks = new THREE.Group();
    this.choppedBlocks = new THREE.Group();

    this.stage.add(this.newBlocks);
    this.stage.add(this.placedBlocks);
    this.stage.add(this.choppedBlocks);

    this.addBlock();
    this.tick();

    this.updateState(this.STATES.READY);

    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.keyCode === 32) {
        e.preventDefault();
        e.stopPropagation();
        this.onAction();
      }
    };

    this.clickHandler = () => {
      this.onAction();
    };

    this.touchstartHandler = (e: TouchEvent) => {
      e.preventDefault();
    };

    document.addEventListener('keydown', this.keydownHandler);
    document.addEventListener('click', this.clickHandler);
    document.addEventListener('touchstart', this.touchstartHandler, { passive: false });
  }

  updateState(newState: StageState) {
    for (const key in this.STATES) {
      this.mainContainer.classList.remove(this.STATES[key as keyof typeof this.STATES]);
    }
    this.mainContainer.classList.add(newState);
    this.state = newState;
    if (this.onStateChange) {
      this.onStateChange(newState);
    }
  }

  onAction() {
    switch (this.state) {
      case this.STATES.READY:
        this.startGame();
        break;
      case this.STATES.PLAYING:
        this.placeBlock();
        break;
      case this.STATES.ENDED:
        this.restartGame();
        break;
    }
  }

  startGame() {
    if (this.state !== this.STATES.PLAYING) {
      this.scoreContainer.innerHTML = '0';
      this.updateState(this.STATES.PLAYING);
      this.addBlock();
    }
  }

  restartGame() {
    this.updateState(this.STATES.RESETTING);

    const oldBlocks = this.placedBlocks.children;
    const removeSpeed = 0.2;
    const delayAmount = 0.02;
    for (let i = 0; i < oldBlocks.length; i += 1) {
      TweenLite.to((oldBlocks[i] as THREE.Mesh).scale, {
        duration: removeSpeed,
        x: 0,
        y: 0,
        z: 0,
        delay: (oldBlocks.length - i) * delayAmount,
        ease: Power1.easeIn,
        onComplete: () => {
          this.placedBlocks.remove(oldBlocks[i]);
        },
      });
      TweenLite.to((oldBlocks[i] as THREE.Mesh).rotation, {
        duration: removeSpeed,
        y: 0.5,
        delay: (oldBlocks.length - i) * delayAmount,
        ease: Power1.easeIn,
      });
    }

    const cameraMoveSpeed = removeSpeed * 2 + oldBlocks.length * delayAmount;
    this.stage.setCamera(2, cameraMoveSpeed);

    const countdown = { value: this.blocks.length - 1 };
    TweenLite.to(countdown, {
      duration: cameraMoveSpeed,
      value: 0,
      onUpdate: () => {
        this.scoreContainer.innerHTML = String(Math.round(countdown.value));
        if (this.onScore) {
          this.onScore(Math.max(0, Math.round(countdown.value)));
        }
      },
    });

    this.blocks = this.blocks.slice(0, 1);

    window.setTimeout(() => {
      this.startGame();
    }, cameraMoveSpeed * 1000);
  }

  placeBlock() {
    const currentBlock = this.blocks[this.blocks.length - 1];
    const newBlocks: BlockReturn = currentBlock.place();
    this.newBlocks.remove(currentBlock.mesh);
    if (newBlocks.placed) {
      this.placedBlocks.add(newBlocks.placed);
    }

    if (newBlocks.chopped) {
      this.choppedBlocks.add(newBlocks.chopped);
      const positionParams: Record<string, unknown> = {
        y: '-=30',
        ease: Power1.easeIn,
        onComplete: () => this.choppedBlocks.remove(newBlocks.chopped as THREE.Object3D),
      };
      const rotateRandomness = 10;
      const rotationParams = {
        delay: 0.05,
        x: newBlocks.plane === 'z' ? Math.random() * rotateRandomness - rotateRandomness / 2 : 0.1,
        z: newBlocks.plane === 'x' ? Math.random() * rotateRandomness - rotateRandomness / 2 : 0.1,
        y: Math.random() * 0.1,
      };
      if (newBlocks.chopped.position[newBlocks.plane] > (newBlocks.placed as THREE.Mesh).position[newBlocks.plane]) {
        positionParams[newBlocks.plane] = `+=${40 * Math.abs(newBlocks.direction)}`;
      } else {
        positionParams[newBlocks.plane] = `-=${40 * Math.abs(newBlocks.direction)}`;
      }

      TweenLite.to(newBlocks.chopped.position, {
        duration: 1,
        ...positionParams,
      });
      TweenLite.to(newBlocks.chopped.rotation, {
        duration: 1,
        ...rotationParams,
      });
    }

    this.addBlock();
  }

  addBlock() {
    const lastBlock = this.blocks[this.blocks.length - 1];

    if (lastBlock && lastBlock.state === lastBlock.STATES.MISSED) {
      this.endGame();
      return;
    }

    const score = this.blocks.length - 1;
    this.scoreContainer.innerHTML = String(score);
    if (this.onScore) {
      this.onScore(Math.max(0, score));
    }

    const newKidOnTheBlock = new Block(lastBlock);
    this.newBlocks.add(newKidOnTheBlock.mesh);
    this.blocks.push(newKidOnTheBlock);

    this.stage.setCamera(this.blocks.length * 2);

    if (this.blocks.length >= 5) {
      this.instructions.classList.add('hide');
    }
  }

  endGame() {
    this.updateState(this.STATES.ENDED);
    const finalScore = Math.max(0, this.blocks.length - 2);
    if (this.onEnd) {
      this.onEnd(finalScore);
    }
  }

  tick = () => {
    const active = this.blocks[this.blocks.length - 1];
    if (active) {
      active.tick();
    }
    this.stage.render();
    this.rafId = requestAnimationFrame(this.tick);
  };

  destroy() {
    cancelAnimationFrame(this.rafId);
    document.removeEventListener('keydown', this.keydownHandler);
    document.removeEventListener('click', this.clickHandler);
    document.removeEventListener('touchstart', this.touchstartHandler);
    this.stage.destroy();
  }
}

export default function StackTower() {
  const { user, refreshUser } = useAuth();
  const hideGameLeaderboards = useHideGameLeaderboards();
  const { containerRef: gameContainerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();
  const gameRef = useRef<Game | null>(null);

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [state, setState] = useState<StageState>('loading');
  const [reward, setReward] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const leaderboardVisible = showLeaderboard && !hideGameLeaderboards;

  const fetchStats = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    try {
      const response = await gamesApi.getStats(GAME_TYPE, user.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch (error) {
      console.error('Failed to fetch stack tower stats:', error);
    }
  }, [user?.id]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard(GAME_TYPE, 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch stack tower leaderboard:', error);
    }
  }, []);

  const submitScore = useCallback(async (finalScore: number) => {
    try {
      const response = await gamesApi.complete(GAME_TYPE, {
        score: finalScore,
        won: finalScore > 0,
      });

      setReward({
        aura: response.data.auraReward,
        money: response.data.moneyReward,
      });
      setIsNewHighScore(response.data.isNewHighScore);

      if (response.data.isNewHighScore) {
        setHighScore(finalScore);
      }

      await refreshUser();
      fetchLeaderboard();
    } catch (error) {
      console.error('Failed to submit stack tower score:', error);
    }
  }, [fetchLeaderboard, refreshUser]);

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, [fetchLeaderboard, fetchStats]);

  useEffect(() => {
    if (hideGameLeaderboards) {
      setShowLeaderboard(false);
    }
  }, [hideGameLeaderboards]);

  const handleDeleteScore = useCallback(async (userId: string, _username: string) => {

    try {
      await gamesApi.deleteStats(GAME_TYPE, userId);
      if (userId === user?.id) {
        setHighScore(0);
      }
      fetchLeaderboard();
    } catch (error) {
      console.error('Failed to delete stack tower score:', error);
    }
  }, [fetchLeaderboard, user?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (gameRef.current) {
        return;
      }

      const game = new Game({
        onScore: (value) => {
          setScore(value);
        },
        onStateChange: (nextState) => {
          setState(nextState);
          if (nextState === 'playing') {
            setReward(null);
            setIsNewHighScore(false);
          }
        },
        onEnd: (finalScore) => {
          setScore(finalScore);
          void submitScore(finalScore);
        },
      });
      gameRef.current = game;
    }, 0);

    return () => {
      window.clearTimeout(timer);
      if (gameRef.current) {
        gameRef.current.destroy();
        gameRef.current = null;
      }
    };
  }, [submitScore]);

  return (
    <div
      ref={gameContainerRef}
      className={cn(
        'relative flex flex-col gap-3 px-4 pb-6 lg:px-6 lg:pb-8',
        isFullscreen && 'min-h-screen w-screen items-center bg-background px-4 py-4',
      )}
    >
          <GameTopBar
            title="Stack Tower"
            score={score}
            highScore={highScore}
            isNewHighScore={isNewHighScore}
            rewards={reward}
            controls={(
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Espace ou clic pour poser un bloc.</p>
                <p className="text-xs text-muted-foreground">Le timing garde la tour stable.</p>
              </div>
            )}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            showLeaderboard={leaderboardVisible}
            onToggleLeaderboard={() => setShowLeaderboard((value) => !value)}
            className="w-full max-w-[900px]"
          />

      <div className="flex items-start justify-center gap-4">
        <div className="flex w-full max-w-[900px] flex-col">
          <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={STAGE_WIDTH} baseHeight={STAGE_HEIGHT}>
            <div id="container" className={cn('relative h-full w-full overflow-hidden rounded-xl border border-border bg-background')}>
              <div id="game" className="absolute inset-0" />

              <div className={cn('pointer-events-none absolute left-4 top-4 rounded-md bg-black/35 px-3 py-1.5 text-sm text-white', state === 'playing' ? 'opacity-100' : 'opacity-0')}>
                <span className="font-semibold">Score:</span> <span id="score">0</span>
              </div>

              <div
                id="instructions"
                className={cn(
                  'pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-black/35 px-3 py-1.5 text-xs text-white transition-opacity',
                  state === 'playing' ? 'opacity-100' : 'opacity-0',
                )}
              >
                Clique ou appuie sur Espace
              </div>

              <button id="start-button" type="button" className="hidden" aria-hidden="true" />

              {state === 'ready' && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/65">
                  <div className="text-center">
                    <p className="text-3xl font-light">Tour empilée</p>
                  </div>
                </div>
              )}

              {state === 'ended' && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/72">
                  <div className="space-y-2 text-center">
                    <p className="text-2xl font-light">Partie terminée</p>
                    <p className="text-4xl tabular-nums">{score}</p>
                    {isNewHighScore && <p className="text-sm">Nouveau record personnel.</p>}
                    {reward && (reward.money > 0 || reward.aura > 0) && (
                      <p className="text-sm text-muted-foreground">
                        {reward.money > 0 && `+$${reward.money}`}
                        {reward.money > 0 && reward.aura > 0 && ' · '}
                        {reward.aura > 0 && `+${reward.aura} aura`}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </GameFullscreenStage>
        </div>

        {leaderboardVisible && !isFullscreen && (
          <div className="w-[240px] shrink-0 hidden lg:block">
            <GameLeaderboard
              entries={leaderboard}
              currentUserId={user?.id}
              personalHighScore={highScore}
              isAdmin={user?.isAdmin}
              onDeleteScore={handleDeleteScore}
              maxHeight={540}
            />
          </div>
        )}
      </div>
    </div>
  );
}

