"""Continuity tests for the generator and the *decoded* distributed panorama."""
import importlib.util
import json
from pathlib import Path
import unittest
import numpy as np
from scipy.ndimage import map_coordinates
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('bake_sky',ROOT/'tools/bake_sky.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class SkyBakeTest(unittest.TestCase):
 def setUp(self):
  self.grid=np.random.default_rng(106).random((40,40,40),dtype=np.float32)
 def test_reproduces_old_internal_cut_and_removes_it(self):
  xs=np.array([39-1e-5,39,39+1e-5])
  coords=[np.full(3,19.7),np.full(3,20.3),xs]
  old=map_coordinates(self.grid,[v%39 for v in coords],order=1,mode='wrap',prefilter=False)
  new=module.volume_sample(self.grid,coords)
  self.assertGreater(float(abs(np.diff(old)).max()),.04)
  self.assertLess(float(abs(np.diff(new)).max()),1e-4)
 def test_periodic_lattice_interpolates_across_each_axis(self):
  epsilon=1e-5
  for axis in range(3):
   for boundary in [-80,-40,0,39,40,80]:
    coords=[np.full(3,19.7),np.full(3,20.3),np.full(3,12.1)]
    coords[axis]=np.array([boundary-epsilon,boundary,boundary+epsilon])
    values=module.volume_sample(self.grid,coords)
    self.assertLess(float(abs(np.diff(values)).max()),1e-4)
 def test_periodic_volume_repeats_after_40_samples_not_39(self):
  points=np.random.default_rng(8).uniform(-120,120,(3,100))
  np.testing.assert_allclose(module.volume_sample(self.grid,points),module.volume_sample(self.grid,points+40),atol=1e-6)
 def test_sphere_closes_at_every_meridian_and_both_poles(self):
  for latitude in np.linspace(-np.pi/2,np.pi/2,31):
   for longitude in np.linspace(-np.pi,np.pi,41):
    def xyz(angle):return np.array([[np.sin(latitude)],[np.sin(angle)*np.cos(latitude)],[np.cos(angle)*np.cos(latitude)]])*116+19
    np.testing.assert_allclose(module.volume_sample(self.grid,xyz(longitude)),module.volume_sample(self.grid,xyz(longitude+2*np.pi)),atol=1e-6)
 def test_encoded_map_is_lossless_and_power_of_two(self):
  blob=(ROOT/'assets/universe.webp').read_bytes()
  self.assertIn(b'VP8L',blob[:40])
  with Image.open(ROOT/'assets/universe.webp') as image:self.assertEqual(image.size,(4096,2048))
 def test_decoded_north_south_poles_are_single_colours(self):
  with Image.open(ROOT/'assets/universe.webp') as image:a=np.asarray(image.convert('RGB'))
  self.assertTrue(np.all(a[0]==a[0,0]));self.assertTrue(np.all(a[-1]==a[-1,0]))
 def test_galaxy_radial_support_is_zero_outside_no_rectangular_crop(self):
  rho=np.array([0,1.35,1.6,2,2.3,3])
  taper=1-module.smoothstep((rho-1.35)/.65)
  np.testing.assert_array_equal(taper[-3:],0)
  self.assertEqual(taper[0],1);self.assertGreater(taper[2],0)

if __name__=='__main__':unittest.main(verbosity=2)
