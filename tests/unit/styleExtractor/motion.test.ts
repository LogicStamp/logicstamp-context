import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import {
  extractMotionConfig,
  extractAnimationMetadata,
} from '../../../src/core/styleExtractor/motion.js';

describe('Motion Extractor', () => {
  describe('extractMotionConfig', () => {
    it('should extract motion components', () => {
      const sourceCode = `
        import { motion } from 'framer-motion';
        
        function MyComponent() {
          return (
            <motion.div>
              <motion.button>Click</motion.button>
            </motion.div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMotionConfig(sourceFile);

      expect(result.components).toContain('div');
      expect(result.components).toContain('button');
      expect(result.components).toEqual(result.components.sort());
    });

    it('should extract variant names', () => {
      const sourceCode = `
        import { motion } from 'framer-motion';
        
        const variants = {
          hidden: { opacity: 0 },
          visible: { opacity: 1 },
        };
        
        function MyComponent() {
          return <motion.div variants={variants}>Hello</motion.div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMotionConfig(sourceFile);

      expect(result.variants.length).toBeGreaterThan(0);
    });

    it('should detect gesture handlers', () => {
      const sourceCode = `
        import { motion } from 'framer-motion';
        
        function MyComponent() {
          return (
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              Hover me
            </motion.div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMotionConfig(sourceFile);

      expect(result.hasGestures).toBe(true);
    });

    it('should detect layout animations', () => {
      const sourceCode = `
        import { motion } from 'framer-motion';
        
        function MyComponent() {
          return <motion.div layout={true}>Animated</motion.div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMotionConfig(sourceFile);

      expect(result.hasLayout).toBe(true);
    });

    it('should detect viewport animations', () => {
      const sourceCode = `
        import { motion, useInView } from 'framer-motion';
        
        function MyComponent() {
          const ref = useRef(null);
          const isInView = useInView(ref);
          return <motion.div ref={ref}>Scroll me</motion.div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMotionConfig(sourceFile);

      expect(result.hasViewport).toBe(true);
    });

    it('should not detect gestures when Framer Motion is not imported', () => {
      const sourceCode = `
        function MyComponent() {
          return <div whileHover={{ scale: 1.1 }}>Hover me</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMotionConfig(sourceFile);

      expect(result.hasGestures).toBe(false);
    });

    it('should not detect layout when Framer Motion is not imported', () => {
      const sourceCode = `
        function MyComponent() {
          return <div layout={true}>Content</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMotionConfig(sourceFile);

      expect(result.hasLayout).toBe(false);
    });

    it('should detect framer-motion/client imports', () => {
      const sourceCode = `
        import { motion } from 'framer-motion/client';
        
        function MyComponent() {
          return <motion.div>Hello</motion.div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMotionConfig(sourceFile);

      expect(result.components).toContain('div');
    });

    it('should handle empty file', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      const result = extractMotionConfig(sourceFile);

      expect(result.components).toEqual([]);
      expect(result.variants).toEqual([]);
      expect(result.hasGestures).toBe(false);
      expect(result.hasLayout).toBe(false);
      expect(result.hasViewport).toBe(false);
    });
  });

  describe('extractAnimationMetadata', () => {
    it('should detect framer-motion library', () => {
      const sourceCode = `
        import { motion } from 'framer-motion';
        
        function MyComponent() {
          return <motion.div>Hello</motion.div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAnimationMetadata(sourceFile);

      expect(result.library).toBe('framer-motion');
    });

    it('should detect fade-in animation', () => {
      const sourceCode = `
        import { motion } from 'framer-motion';
        
        function MyComponent() {
          return <motion.div animate={{ opacity: 1 }}>Hello</motion.div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAnimationMetadata(sourceFile);

      expect(result.type).toBe('fade-in');
    });

    it('should detect useInView trigger', () => {
      const sourceCode = `
        import { useInView } from 'framer-motion';
        
        function MyComponent() {
          const isInView = useInView();
          return <div>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAnimationMetadata(sourceFile);

      expect(result.trigger).toBe('inView');
    });

    it('should detect CSS animations', () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="animate-spin">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAnimationMetadata(sourceFile);

      expect(result.library).toBe('css');
      expect(result.type).toBe('spin');
    });

    it('should detect CSS animations with hyphenated names', () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="animate-fade-in">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAnimationMetadata(sourceFile);

      expect(result.library).toBe('css');
      expect(result.type).toBe('fade-in');
    });

    it('should not detect transitions from className alone', () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="text-blue-500">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAnimationMetadata(sourceFile);

      expect(result.library).toBeUndefined();
    });

    it('should detect CSS transitions from transition- classes', () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="transition-all duration-300">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAnimationMetadata(sourceFile);

      expect(result.library).toBe('css');
    });

    it('should detect framer-motion/client imports', () => {
      const sourceCode = `
        import { motion } from 'framer-motion/client';
        
        function MyComponent() {
          return <motion.div>Hello</motion.div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAnimationMetadata(sourceFile);

      expect(result.library).toBe('framer-motion');
    });

    it('should prioritize framer-motion over CSS', () => {
      const sourceCode = `
        import { motion } from 'framer-motion';
        
        function MyComponent() {
          return <motion.div className="animate-spin">Hello</motion.div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAnimationMetadata(sourceFile);

      expect(result.library).toBe('framer-motion');
    });

    it('should handle empty file', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      const result = extractAnimationMetadata(sourceFile);

      expect(Object.keys(result)).toHaveLength(0);
    });
  });
});

