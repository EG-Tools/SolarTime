"""Exercise home framing through the app's real startup and projection."""
import importlib.util
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
from regression_diagnostics import BrowserDiagnostics
from tracking_lens import verify_tracking_lens


def main():
    root = Path(__file__).resolve().parents[2]
    spec = importlib.util.spec_from_file_location('ui_regression', Path(__file__).with_name('ui-regression.py'))
    ui = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ui)
    ui.diagnostics = BrowserDiagnostics(root, 'default-framing', [])
    reports = []
    try:
        with sync_playwright() as p:
            options = {'headless': True, 'args': ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']}
            if os.environ.get('SOLAR_CHROMIUM_EXECUTABLE'):
                options['executable_path'] = os.environ['SOLAR_CHROMIUM_EXECUTABLE']
            browser = p.chromium.launch(**options)
            try:
                for size in [(1280, 800), (390, 844)]:
                    context, page, _, errors = ui.load(browser, root, size)
                    try:
                        rows = page.evaluate("""() => {
                          const r=SolarTime.renderer,ms=SolarTime.getState().simulationMs,rows=[];
                          r.stopAutoRotate();
                          const measure=label=>{
                            r.rebuild(ms);r.updateFrameBodies(ms);r.updateProjectionAnchor();
                            const orbit=r.paths.find(p=>p.body.id==='neptune');
                            const points=orbit.points.map(p=>r.project(r.displaySolarPoint(p,orbit.body)));
                            const sun=r.project(r.currentFrameItem('sun').world);
                            rows.push({label,width:(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)))/r.w,
                              sunY:sun.y/r.h,clipped:points.some(p=>p.behind)});
                          };
                          measure('fresh startup');
                          for(const spacing of [0,.05,.5,1]){
                            r.setOption('actualScale',true,false);r.setOption('actualOrbitSpacing',spacing,false);
                            r.restoreCamera(r.defaultCameraSnapshot(ms));measure('actual spacing '+spacing);
                          }
                          return rows;
                        }""")
                        for row in rows:
                            assert not row['clipped'], (size, row)
                            assert abs(row['width'] - .75) < .0001, (size, row)
                            assert abs(row['sunY'] - .57) < .0001, (size, row)
                        verify_tracking_lens(page)
                        assert not errors, errors
                        reports.append({'size': size, 'rows': rows})
                    finally:
                        context.close()
            finally:
                browser.close()
    finally:
        ui.diagnostics.finish()
    print(json.dumps(reports, ensure_ascii=False))


if __name__ == '__main__':
    main()
