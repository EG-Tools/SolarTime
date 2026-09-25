"""Real Chromium audio/Blob checks using silent generated WAVs; no PC shutdown."""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright


def main():
    root = Path(__file__).resolve().parents[2]
    report = {"mode": "Chromium silent WAV audio; not a physical iPhone", "passed": False}
    try:
        with sync_playwright() as p:
            options = {"headless": True, "args": ["--no-sandbox"]}
            if os.environ.get("SOLAR_CHROMIUM_EXECUTABLE"):
                options["executable_path"] = os.environ["SOLAR_CHROMIUM_EXECUTABLE"]
            browser = p.chromium.launch(**options)
            try:
                page = browser.new_page()
                page.route("**/*", lambda route: route.abort())
                page.set_content('<button id="run">Test silent audio</button>')
                page.add_script_tag(content=(root / "src/alarm-sound.js").read_text(encoding="utf8"))
                page.evaluate(r"""() => {
                  const wav = seconds => {
                    const samples=8000*seconds,bytes=new ArrayBuffer(44+samples*2),view=new DataView(bytes);
                    const text=(at,s)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
                    text(0,'RIFF');view.setUint32(4,36+samples*2,true);text(8,'WAVE');text(12,'fmt ');
                    view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,8000,true);view.setUint32(28,16000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples*2,true);
                    return new Blob([bytes],{type:'audio/wav'});
                  };
                  document.querySelector('#run').onclick=async()=>{
                    let context,short,long,media;
                    try {
                      context=new AudioContext();await context.resume();
                      const api=SolarModules.AlarmSound;
                      short=await api.prepare(wav(1),{getContext:()=>context});
                      long=await api.prepare(wav(61),{getContext:()=>context});
                      if(!short.buffer||short.url||long.buffer||!long.url)throw Error('Wrong decode/stream selection');
                      const gain=context.createGain(),source=context.createBufferSource();gain.gain.value=.864;source.buffer=short.buffer;source.connect(gain).connect(context.destination);source.start();source.stop();source.disconnect();gain.disconnect();
                      media=new Audio(long.url);media.volume=.864;await media.play();
                      window.result={shortDecodedBytes:api.decodedBytes(short.buffer),longStreamed:true,mediaVolume:media.volume,webAudioGain:gain.gain.value,playing:!media.paused};
                    }catch(error){window.audioError=String(error.stack||error);}
                    finally{if(media){media.pause();media.src='';media.load();}short?.dispose();long?.dispose();await context?.close();window.audioDone=true;}
                  };
                }""")
                page.click("#run")
                page.wait_for_function("window.audioDone===true", timeout=30000)
                assert not page.evaluate("window.audioError||''"), page.evaluate("window.audioError")
                result = page.evaluate("window.result")
                assert result["longStreamed"] and result["playing"]
                assert abs(result["mediaVolume"] - .864) < 1e-7
                assert abs(result["webAudioGain"] - .864) < 1e-7
                assert result["shortDecodedBytes"] <= 32 * 1024 * 1024
                report.update(passed=True, **result)
            finally:
                browser.close()
    except Exception as error:
        report["error"] = str(error)
        raise
    finally:
        out = root / ".cloudflare/alarm-audio-verification.json"
        out.parent.mkdir(exist_ok=True)
        out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf8")
    print("Real Chromium alarm audio checks passed: short decode, long stream, gain, cleanup.")

if __name__ == "__main__":
    main()
