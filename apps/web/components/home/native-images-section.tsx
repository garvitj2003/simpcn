import Link from 'next/link';
import { CodeBlock } from '@/components/shared/code-block';
import './native-images-section.css';

export function NativeImagesSection() {
  return <section className="home-section native-images" id="react-native" aria-labelledby="native-images-title">
    <div className="home-section-heading">
      <h2 id="native-images-title">Native images.<br />Same source.</h2>
      <p>React Native with Expo, now in experimental support. Keep your image references while Simpcn prepares verified CDN sources for iOS, Android, and different screen densities.</p>
    </div>
    <div className="native-images-layout">
      <dl className="native-images-features">
        <div><dt>Static imports and require()</dt><dd>Keep importing an image or passing a literal require() to Image, ImageBackground, or expo-image. Supported production references move to the CDN.</dd></div>
        <div><dt>iOS and Android artwork</dt><dd>Use <code>.ios</code> and <code>.android</code> files behind one image reference. Each platform gets its own family, with a generic fallback when needed.</dd></div>
        <div><dt>Sharp at @2x and @3x</dt><dd>Provide the density variants. Simpcn chooses a CDN image for the device’s pixel ratio and preserves its logical display dimensions.</dd></div>
      </dl>
      <div className="native-images-example">
        <CodeBlock label="Your component · unchanged" language="tsx" code={"import { Image } from 'react-native';\nimport logo from './assets/cdn/logo.png';\n\n<Image source={logo} />;"} />
        <CodeBlock label="Your images · platform + density" code={"logo.ios.png          // 24 × 24 pixels\nlogo@2x.ios.png       // 48 × 48 pixels\nlogo.android.png      // 24 × 24 pixels\nlogo@3x.android.png   // 72 × 72 pixels"} />
      </div>
    </div>
    <p className="native-images-status">The Expo adapter is experimental. Android/iOS exports are tested; device, EAS, and OTA validation remain. Essential and excluded images stay local.</p>
    <Link className="native-images-link" href="/docs/react-native-expo">Explore React Native with Expo <span aria-hidden="true">↗</span></Link>
  </section>;
}
