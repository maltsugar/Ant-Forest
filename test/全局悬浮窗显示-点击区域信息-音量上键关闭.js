let sRequire = require('../lib/SingletonRequirer.js')(runtime, this)
let automator = sRequire('Automator')
let { debugInfo, warnInfo, errorInfo, infoLog, logInfo, debugForDev } = sRequire('LogUtils')
let _BaseScanner = require('../core/BaseScanner.js')
let { config } = require('../config.js')
let _base_scanner = new _BaseScanner()

let TARGET_LAY = 1

var window = floaty.rawWindow(
  <canvas id="canvas" layout_weight="1" />
);


window.setSize(config.device_width, config.device_height)
window.setTouchable(false)

function convertArrayToRect (a) {
  // origin array left top width height
  // left top right bottom
  return new android.graphics.Rect(a[0], a[1], (a[0] + a[2]), (a[1] + a[3]))
}

function getPositionDesc (position) {
  return position[0] + ', ' + position[1] + ' w:' + position[2] + ',h:' + position[3]
}

function getRectCenter (position) {
  return {
    x: parseInt(position[0] + position[2] / 2),
    y: parseInt(position[1] + position[3] / 2)
  }
}

function drawRectAndText (desc, position, colorStr, canvas, paint) {
  let color = colors.parseColor(colorStr)

  paint.setStrokeWidth(1)
  paint.setStyle(Paint.Style.STROKE)
  // 反色
  paint.setARGB(255, 255 - (color >> 16 & 0xff), 255 - (color >> 8 & 0xff), 255 - (color & 0xff))
  canvas.drawRect(convertArrayToRect(position), paint)
  paint.setARGB(255, color >> 16 & 0xff, color >> 8 & 0xff, color & 0xff)
  paint.setStrokeWidth(1)
  paint.setTextSize(20)
  paint.setStyle(Paint.Style.FILL)
  canvas.drawText(desc, position[0], position[1], paint)
  paint.setTextSize(10)
  paint.setStrokeWidth(1)
  paint.setARGB(255, 0, 0, 0)
  // let center = getRectCenter(position)
  // canvas.drawText(getPositionDesc(position), center.x, center.y, paint)
}

function drawText (text, position, canvas, paint) {
  paint.setARGB(255, 0, 0, 255)
  paint.setStrokeWidth(1)
  paint.setStyle(Paint.Style.FILL)
  canvas.drawText(text, position.x, position.y, paint)
}

function drawCoordinateAxis (canvas, paint) {
  let width = canvas.width
  let height = canvas.height
  paint.setStyle(Paint.Style.FILL)
  paint.setTextSize(10)
  let colorVal = colors.parseColor('#65f4fb')
  paint.setARGB(255, colorVal >> 16 & 0xFF, colorVal >> 8 & 0xFF, colorVal & 0xFF)
  for (let x = 50; x < width; x += 50) {
    paint.setStrokeWidth(0)
    canvas.drawText(x, x, 10, paint)
    paint.setStrokeWidth(0.5)
    canvas.drawLine(x, 0, x, height, paint)
  }

  for (let y = 50; y < height; y += 50) {
    paint.setStrokeWidth(0)
    canvas.drawText(y, 0, y, paint)
    paint.setStrokeWidth(0.5)
    canvas.drawLine(0, y, width, y, paint)
  }
}

function exitAndClean () {
  if (window !== null) {
    window.canvas.removeAllListeners()
    toastLog('close in 1 seconds')
    sleep(1000)
    window.close()
  }
  exit()
}

let converted = false
let startTime = new Date().getTime()
// 两分钟后自动关闭
let targetEndTime = startTime + 120000
let passwindow = 0
let count = 0

window.canvas.on("draw", function (canvas) {
  try {
    // 清空内容
    canvas.drawColor(0xFFFFFF, android.graphics.PorterDuff.Mode.CLEAR);
    var width = canvas.getWidth()
    var height = canvas.getHeight()
    if (!converted) {
      toastLog('画布大小：' + width + ', ' + height)
    }

    // let canvas = new com.stardust.autojs.core.graphics.ScriptCanvas(width, height)
    let Typeface = android.graphics.Typeface
    var paint = new Paint()
    paint.setStrokeWidth(1)
    paint.setTypeface(Typeface.DEFAULT_BOLD)
    paint.setTextAlign(Paint.Align.LEFT)
    paint.setAntiAlias(true)
    paint.setStrokeJoin(Paint.Join.ROUND)
    paint.setDither(true)
    let targetLayerTime = TARGET_LAY || 2
    if (targetLayerTime === 2) {
      paint.setTextSize(20)
      drawText('当前展示的是参考的点击区域，点击两层但是较慢：', { x: 100, y: 400 }, canvas, paint)
      // 展示多行
      for (let x = 200; x <= 900; x += 100) {
        for (let y = 650; y <= 750; y += 100) {
          let px = x
          let py = x < 550 ? y - (0.5 * x - 150) : y - (-0.5 * x + 400)
          drawRectAndText(px + ',' + py, [px - 5, py - 5, 10, 10], '#00ff00', canvas, paint)
        }
      }
    } else {
      paint.setTextSize(20)
      drawText('当前展示的是脚本执行时实际点击的区域：', { x: 100, y: 400 }, canvas, paint)
      drawText('如果已扩展MultiTouchCollect.js也会直接展示：', { x: 100, y: 430 }, canvas, paint)
      // 替换点击方法为 绘制坐标
      automator.click = function (px, py) {
        drawRectAndText(px + ',' + py, [px - 5, py - 5, 10, 10], '#00ff00', canvas, paint)
      }
      // 调用多点点击
      _base_scanner.multiTouchToCollect()
    }

    paint.setTextSize(30)
    let countdown = (targetEndTime - new Date().getTime()) / 1000
    drawText('关闭倒计时：' + countdown.toFixed(0) + 's', { x: 100, y: 100 }, canvas, paint)

    passwindow = new Date().getTime() - startTime

    if (passwindow > 1000) {
      startTime = new Date().getTime()
      console.verbose('关闭倒计时：' + countdown.toFixed(2))
    }
    drawCoordinateAxis(canvas, paint)
    converted = true
  } catch (e) {
    toastLog(e)
    exitAndClean()
  }
});

let lastChangedTime = new Date().getTime()
threads.start(function () {
  toastLog('按音量上键关闭，音量下切换')
  events.observeKey()
  events.on("key_down", function (keyCode, event) {
    if (keyCode === 24) {
      exitAndClean()
    } else if (keyCode === 25) {
      // 设置最低间隔200毫秒，避免修改太快
      if (new Date().getTime() - lastChangedTime > 200) {
        TARGET_LAY = TARGET_LAY === 2 ? 1 : 2
        toastLog('切换层：' + TARGET_LAY)
        lastChangedTime = new Date().getTime()
      }
    }
  })
})

setTimeout(function () { exitAndClean() }, 120000)