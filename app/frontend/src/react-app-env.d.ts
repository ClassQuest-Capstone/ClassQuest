/// <reference path="../src/app.tsx" />
/// <reference path="../src/index.tsx" />
/// <reference path="../package-lock.json" />
/// <reference path="../package.json" />

declare namespace React {
    export interface AppProps {
        assetsBucketName: string;
    }
}
declare const App: React.FC<React.AppProps>;
