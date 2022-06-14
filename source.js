let cv = document.getElementById("canvas")

const STATE_IDLE = 1
const STATE_FALLING_PRE = 2
const STATE_FADING_PRE = 3
const STATE_PUSHING = 4
const STATE_FALLING_POST = 5
const STATE_FADING_POST = 6
const STATE_GAME_OVER = 7

const ASSETS_IMAGES = [];

let game = {
    settings: {
        blockSize: Math.min(document.body.scrollHeight / 11, document.body.scrollWidth / 8),
        colors: [
            "red",
            "green",
            "orange",
            "purple",
            "yellow",
            "blue",
        ],
        fallAnimationSpeed: 9.5,
        pushAnimationSpeed: 5,
        width: 8,
        height: 10,
        holeChance: 0.25,
        joinChance: 0.5,
    },

    state: STATE_IDLE,

    interation: {
        isDragging: false,
        dragTarget: null,
        dragStart: 0,
        dragNow: 0,
    },

    animation: {
        isAnimating: false,
        animationTime: 0,
        animations: [],
    },

    currentBlocks: [],

    nextLine: [],

    score: 0,

    lastUpdate: null,
    deltaTime: 0
}

cv.width = game.settings.width * game.settings.blockSize
cv.height = (game.settings.height + 1) * game.settings.blockSize

let ctx = cv.getContext("2d")

function drawRect(x, y, w, h, fill, stroke) {
    ctx.fillStyle = fill
    ctx.strokeStyle = stroke
    ctx.globalAlpha = 1
    ctx.fillRect(x * game.settings.blockSize, (game.settings.height - 1 - y) * game.settings.blockSize, w * game.settings.blockSize, h * game.settings.blockSize)
    ctx.strokeRect(x * game.settings.blockSize, (game.settings.height - 1 - y) * game.settings.blockSize, w * game.settings.blockSize, h * game.settings.blockSize)
}

function drawBlock(block) {
    ctx.fillStyle = block.color
    ctx.strokeStyle =  'grey'
    ctx.globalAlpha = 1

    let extraX = 0
    let extraY = 0

    if (game.interation.isDragging && block == game.interation.dragTarget) {
        extraX = game.interation.dragNow - game.interation.dragStart
    }

    if (game.animation.isAnimating) {
        let animation = game.animation.animations.find(anim => anim.target == block)
        if (animation != null && animation.type == 'fall') {
            let time = (animation.duration - game.animation.animationTime)
            if (time < 0) {
                time = 0
            }
            extraY += animation.direction * animation.speed * time * game.settings.blockSize
        } else if (animation != null && animation.type == 'fade') {
            ctx.globalAlpha = (1 - game.animation.animationTime / animation.duration )
        }
    }

    if (block.width == 1) {
        ctx.drawImage(ASSETS_IMAGES['single'], block.offset * game.settings.blockSize + extraX, (game.settings.height - 1 -  block.line) * game.settings.blockSize + extraY, game.settings.blockSize, game.settings.blockSize)
    } else {
        for (let i = 0 ; i < block.width ; i++) {
            let asset = i == 0 ? 'begin' :
                        i == block.width - 1 ? 'end' :
                        'middle'
            ctx.drawImage(ASSETS_IMAGES[asset], (block.offset + i) * game.settings.blockSize + extraX, (game.settings.height - 1 -  block.line) * game.settings.blockSize + extraY, game.settings.blockSize, game.settings.blockSize)
        }
    }
}

function generateNextLine(holeChance, joinChance) {
    game.nextLine = []
    let runLength = 0
    hasHoles = false
    for (let x = 0 ; x < game.settings.width ; x++) {
        let isHole =  Math.random() < holeChance
        hasHoles |= isHole

        if (isHole && runLength > 0) {
            let color = Math.floor(Math.random() * game.settings.colors.length)
            game.nextLine.push({
                width: runLength,
                line: -1,
                offset: x - runLength,
                color: game.settings.colors[color]
            })
            runLength = 0
        } else if (((!isHole) && (x + 1) == game.settings.width) || (runLength > 0 && Math.random() < joinChance)) {
            let color = Math.floor(Math.random() * game.settings.colors.length)
            game.nextLine.push({
                width: runLength + 1,
                line: -1,
                offset: x - runLength,
                color: game.settings.colors[color]
            })
            runLength = 0
        } else if (!isHole) {
            runLength++
        }
    }

    if (!hasHoles) {
        generateNextLine(holeChance, joinChance)
    }
}

cv.addEventListener("pointerdown", (event) => {
    if (game.state == STATE_IDLE) {
        let rect = cv.getBoundingClientRect()

        let clickX = Math.floor((event.clientX - rect.left) / game.settings.blockSize)
        let clickY = Math.floor((rect.bottom - event.clientY - rect.top) / game.settings.blockSize) - 1

        target = game.currentBlocks.find(block => block.line == clickY && block.offset <= clickX && block.offset + block.width > clickX)
        if (target != null) {
            game.interation.isDragging = true
            game.interation.dragStart = event.clientX
            game.interation.dragNow = event.clientX
            game.interation.dragTarget = target
        }
    }
})

window.addEventListener("pointerup", (event) => {
    if (game.state == STATE_IDLE && game.interation.isDragging) {
        game.interation.isDragging = false

        offsetPixels = game.interation.dragNow - game.interation.dragStart
        offsetGrid = Math.round(offsetPixels / game.settings.blockSize)

        doMoveBlockAction(game.interation.dragTarget, game.interation.dragTarget.offset + offsetGrid)
    }
})

cv.addEventListener("pointermove", (event) => {
    if (game.state == STATE_IDLE && game.interation.isDragging) {
        game.interation.dragNow = event.clientX

        offsetPixels = game.interation.dragNow - game.interation.dragStart
        offsetGridCeil = Math.ceil(offsetPixels / game.settings.blockSize)
        offsetGridFloor = Math.floor(offsetPixels / game.settings.blockSize)
        let target = game.interation.dragTarget

        if (offsetGridCeil > 0) {
            for (let i = 0 ; i <= offsetGridCeil ; i++) {
                if (target.offset + target.width + i > game.settings.width || wouldBlockOverlap(target, target.line, target.offset + i)) {
                    game.interation.dragNow = (i-1) * game.settings.blockSize + game.interation.dragStart
                    break
                }
            }
        }
offsetGridFloor
        if (offsetGridFloor < 0) {
            for (let i = 0 ; i >= offsetGridFloor ; i--) {
                if (target.offset + i < 0 || wouldBlockOverlap(target, target.line, target.offset + i)) {
                    game.interation.dragNow = (i+1) * game.settings.blockSize + game.interation.dragStart
                    break
                }
            }
        }
    }
})

function doMoveBlockAction(block, targetPosition) {
    if (targetPosition < 0 || targetPosition + block.width > game.settings.width || block.offset == targetPosition) {
        return
    }

    if (block.offset < targetPosition) {
        for (x = block.offset ; x <= targetPosition ; x++) {
            if (wouldBlockOverlap(block, block.line, x)) {
                return
            }
        }
    } else if (block.offset > targetPosition) {
        for (x = targetPosition; x <= block.offset ; x++) {
            if (wouldBlockOverlap(block, block.line, x)) {
                return
            }
        }
    }
    
    block.offset = targetPosition
    advanceGameState()
}

function doFallingAnimations() {
    hasFalling = false
    for (line = 0 ; line <= game.settings.height ; line++) {
        game.currentBlocks.forEach(block => {
            if (block.line == line) {
                best = block.line
                for (y = block.line - 1 ; y >= 0 ; y--) {
                    if (wouldBlockOverlap(block, y, block.offset)) {
                        break;
                    } else {
                        best = y
                    }
                }
        
                if (best != block.line) {    
                    game.animation.animations.push({
                        type: 'fall',
                        target: block,
                        direction: -1,
                        duration: (block.line - best) / game.settings.fallAnimationSpeed,
                        speed: game.settings.fallAnimationSpeed,
                    })
                    block.line -= block.line - best
                    hasFalling = true
                }
            }
        })
    }
    game.animation.isAnimating = hasFalling
    return hasFalling
}

function doFadingAnimations() {
    hasFading = false
    for (line = 0 ; line < game.settings.height ; line++) {
        let blocks = game.currentBlocks.filter(block => block.line == line)

        fadeLine = true
        for (x = 0 ; x < game.settings.width ; x++) {
            if (!blocks.some(block => block.offset <= x && block.offset + block.width - 1 >= x)) {
                fadeLine = false
            }
        }

        if (fadeLine) {
            game.score += 1
            updateScore()
            blocks.forEach(block => {
                hasFading = true
                game.animation.animations.push({
                    type: 'fade',
                    target: block,
                    duration: 0.3,
                })
            })
        }
    }

    game.animation.isAnimating = hasFading
    return hasFading
}

function doBlockUpAnimations() {
    game.animation.isAnimating = true
    game.nextLine.forEach(block => {
        game.currentBlocks.push(block)
    })

    generateNextLine(game.settings.holeChance, game.settings.joinChance)

    game.currentBlocks.forEach(block => {
        game.animation.animations.push({
            type: 'fall',
            target: block,
            direction: 1,
            duration: 1 / game.settings.pushAnimationSpeed,
            speed: game.settings.pushAnimationSpeed
        })
        block.line += 1
    })

    return true
}

function advanceGameState() {
    game.animation.isAnimating = false
    game.animation.animationTime = 0
    game.animation.animations = []

    if (game.currentBlocks.some(block => block.line == 10)) {
        game.state = STATE_GAME_OVER
    }

    if (game.state == STATE_IDLE || game.state == STATE_FADING_PRE) {
        if (doFallingAnimations()) {
            game.state = STATE_FALLING_PRE
        } else {
            if (doFadingAnimations()) {
                game.state = STATE_FADING_PRE
            } else {
                doBlockUpAnimations()
                game.state = STATE_PUSHING
            }
        }
    } else if (game.state == STATE_FALLING_PRE) {
        if (doFadingAnimations()) {
            game.state = STATE_FADING_PRE
        } else {
            doBlockUpAnimations()
            game.state = STATE_PUSHING
        }
    }
    else if (game.state == STATE_PUSHING || game.state == STATE_FADING_POST) {
        if (doFallingAnimations()) {
            game.state = STATE_FALLING_POST
        } else {
            if (doFadingAnimations()) {
                game.state = STATE_FADING_POST
            } else {

                if (game.currentBlocks.length == 0) {
                    doBlockUpAnimations()
                    game.state = STATE_PUSHING
                } else {
                    game.state = STATE_IDLE
                    localStorage.setItem("game", JSON.stringify(game))
                }
            }
        }
    } else if (game.state == STATE_FALLING_POST) {
        if (doFadingAnimations()) {
            game.state = STATE_FADING_POST
        } else {
            if (game.currentBlocks.length == 0) {
                doBlockUpAnimations()
                game.state = STATE_PUSHING
            } else {
                game.state = STATE_IDLE
                localStorage.setItem("game", JSON.stringify(game))
            }
        }
    }

    console.log("advanced to: " + game.state)
}

function commitAnimations() {
    game.animation.isAnimating = false

    let toRemove = game.animation.animations
                    .filter(anim => anim.type == 'fade')
                    .map(anim => anim.target)
    
    game.currentBlocks = game.currentBlocks.filter(block => !toRemove.includes(block))

    game.animation.animations = []
}

function wouldBlockOverlap(block, line, pos) {
    return game.currentBlocks.some(other => 
        other != block &&
        other.line == line &&
        other.offset + other.width - 1 >= pos &&
        other.offset <= pos + block.width - 1
    )
}

function tick(timestamp) {
    if (game.lastUpdate === undefined) {
        game.deltaTime = timestamp
    } else {
        game.deltaTime = timestamp - game.lastUpdate
    }
    game.lastUpdate = timestamp

    if (game.animation.isAnimating) {
        game.animation.animationTime += game.deltaTime / 1000
        if (game.animation.animations.every(animation => animation.duration <= game.animation.animationTime)) {
            commitAnimations()
            advanceGameState()
        }
    }

    for (let x = 0; x < game.settings.width ; x++) {
        for (let y = -1 ; y < game.settings.height ; y++) {
            drawRect(x, y, 1, 1, 'black', 'grey')
        }
    }

    game.nextLine.forEach(block => {
        drawRect(block.offset, block.line, block.width, 1, 'grey', 'black')
    })
    
    game.currentBlocks.forEach(block => {
        drawBlock(block)
    })

    window.requestAnimationFrame(tick)
}

function startGame() {
    window.requestAnimationFrame(tick)
}

function resetGame() {
    game.currentBlocks = []
    game.nextLine = []
    game.state = STATE_IDLE
    game.interation.isDragging = false
    game.animation.isAnimating = false
    game.score = 0

    generateNextLine(game.settings.holeChance, game.settings.joinChance)
    advanceGameState()

    updateScore()
}

function loadAsset(assetName) {
    return new Promise((resolve, reject) => {
        var image = new Image()
        image.onload = function() {
            resolve(image)
        }
        image.src = 'assets/' + assetName + '.png'
    })
}

function updateScore() {
    document.getElementById('score').innerText = "Score: " + game.score
}

(async function(assets) {
    for (let i = 0 ; i < assets.length ; i++) {
        ASSETS_IMAGES[assets[i]] = await loadAsset(assets[i])
    }

    const g = localStorage.getItem("game")
    if (g != null) {
        console.log("loading game")
        const loaded = JSON.parse(g)
        const oldgame = game
        game = loaded
        game.settings = oldgame.settings
        startGame()
        updateScore()
    } else {
        resetGame()
        startGame()
    }
})(['begin', 'end', 'middle', 'single'])