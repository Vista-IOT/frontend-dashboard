"""
Calculation Engine for Data-Service

Evaluates calculation tags based on formulas with variables A-H that reference other tags.
Supports IO tags, user tags, stats tags, system tags, and other calculation tags.
Updates DATA_STORE and triggers protocol server updates when values change.
"""

import time
import threading
import re
from typing import Dict, Any, List, Optional, Set
from collections import defaultdict
import logging

# Safe expression evaluator
try:
    from py_expression_eval import Parser
    HAS_EXPRESSION_EVAL = True
except ImportError:
    HAS_EXPRESSION_EVAL = False
    import math

from .datastore import DATA_STORE

logger = logging.getLogger(__name__)


class CalculationEngine:
    """
    Engine for evaluating calculation tags with dependency resolution
    """
    
    def __init__(self):
        self.calculation_tags: Dict[str, Dict[str, Any]] = {}
        self.dependencies: Dict[str, Set[str]] = defaultdict(set)  # calc_tag -> set of tags it depends on
        self.dependents: Dict[str, Set[str]] = defaultdict(set)    # tag -> set of calc_tags that depend on it
        self.evaluation_order: List[str] = []
        self.running = False
        self.thread: Optional[threading.Thread] = None
        self.stop_event = threading.Event()
        self.update_interval = 1.0  # seconds
        
        # Initialize expression parser if available
        if HAS_EXPRESSION_EVAL:
            self.parser = Parser()
        else:
            self.parser = None
            logger.warning("py-expression-eval not installed, using basic eval (less safe)")
    
    def register_calculation_tag(self, tag_name: str, formula: str, variables: Dict[str, str], 
                                 default_value: float = 0.0, period: int = 1):
        """
        Register a calculation tag
        
        Args:
            tag_name: Name of the calculation tag
            formula: Formula expression (e.g., "A + B * 2")
            variables: Dict mapping variable names (A-H) to tag names
            default_value: Initial value
            period: Update period in seconds (not used yet, all tags update at engine interval)
        """
        # Store calculation tag info
        self.calculation_tags[tag_name] = {
            'formula': formula,
            'variables': variables,  # e.g., {'A': 'rohan10', 'B': 'rohan20'}
            'default_value': default_value,
            'period': period,
            'last_value': default_value,
            'last_update': 0,
            'status': 'initializing',
            'error': None
        }
        
        # Build dependency graph
        self.dependencies[tag_name] = set()
        for var_name, tag_ref in variables.items():
            if tag_ref:  # Only if variable is assigned
                self.dependencies[tag_name].add(tag_ref)
                self.dependents[tag_ref].add(tag_name)
        
        # Initialize in DATA_STORE
        DATA_STORE.write(tag_name, default_value)
        
        # Rebuild evaluation order
        self._build_evaluation_order()
        
        logger.info(f"Registered calculation tag: {tag_name} = {formula}")
        logger.debug(f"  Variables: {variables}")
        logger.debug(f"  Dependencies: {self.dependencies[tag_name]}")
    
    def unregister_calculation_tag(self, tag_name: str):
        """Remove a calculation tag"""
        if tag_name in self.calculation_tags:
            # Remove from dependency graph
            for dep in self.dependencies[tag_name]:
                self.dependents[dep].discard(tag_name)
            
            del self.calculation_tags[tag_name]
            del self.dependencies[tag_name]
            
            # Rebuild evaluation order
            self._build_evaluation_order()
            
            logger.info(f"Unregistered calculation tag: {tag_name}")
    
    def _build_evaluation_order(self):
        """
        Build evaluation order using topological sort to handle dependencies
        Calculation tags that depend on other calculation tags must be evaluated after their dependencies
        """
        # Kahn's algorithm for topological sort
        in_degree = defaultdict(int)
        calc_tag_names = set(self.calculation_tags.keys())
        
        # Calculate in-degrees (only count dependencies on other calc tags)
        for tag_name in calc_tag_names:
            for dep in self.dependencies[tag_name]:
                if dep in calc_tag_names:  # Only count calc tag dependencies
                    in_degree[tag_name] += 1
        
        # Start with tags that have no calc tag dependencies
        queue = [tag for tag in calc_tag_names if in_degree[tag] == 0]
        evaluation_order = []
        
        while queue:
            # Sort for deterministic order
            queue.sort()
            tag_name = queue.pop(0)
            evaluation_order.append(tag_name)
            
            # Reduce in-degree for dependent calc tags
            for dependent in self.dependents[tag_name]:
                if dependent in calc_tag_names:
                    in_degree[dependent] -= 1
                    if in_degree[dependent] == 0:
                        queue.append(dependent)
        
        # Check for circular dependencies
        if len(evaluation_order) != len(calc_tag_names):
            missing = calc_tag_names - set(evaluation_order)
            logger.error(f"Circular dependency detected in calculation tags: {missing}")
            # Add them anyway to avoid silent failures
            evaluation_order.extend(sorted(missing))
        
        self.evaluation_order = evaluation_order
        logger.debug(f"Evaluation order: {self.evaluation_order}")
    
    def _get_tag_value(self, tag_name: str) -> Optional[float]:
        """
        Get the current value of a tag from DATA_STORE
        
        Args:
            tag_name: Name of the tag (can be IO tag, user tag, calc tag, etc.)
            
        Returns:
            Tag value as float, or None if not found
        """
        value = DATA_STORE.read(tag_name)
        if value is not None:
            try:
                return float(value)
            except (ValueError, TypeError):
                logger.warning(f"Tag {tag_name} has non-numeric value: {value}")
                return None
        return None
    
    def _evaluate_formula(self, tag_name: str, formula: str, variables: Dict[str, str]) -> Optional[float]:
        """
        Evaluate a formula with variable substitution
        
        Args:
            tag_name: Name of the calculation tag (for logging)
            formula: Formula expression (e.g., "A + B * 2")
            variables: Dict mapping variable names to tag names
            
        Returns:
            Calculated value or None if evaluation failed
        """
        try:
            # Build variable context
            context = {}
            for var_name, tag_ref in variables.items():
                if tag_ref:  # Variable is assigned
                    value = self._get_tag_value(tag_ref)
                    if value is None:
                        logger.warning(f"Tag {tag_ref} (variable {var_name}) not found for {tag_name}")
                        value = 0.0  # Use 0 as default
                    context[var_name] = value
                else:
                    context[var_name] = 0.0  # Unassigned variable defaults to 0
            
            # Evaluate using safe parser if available
            if self.parser:
                try:
                    expr = self.parser.parse(formula)
                    result = expr.evaluate(context)
                    return float(result)
                except Exception as e:
                    logger.error(f"Error parsing formula for {tag_name}: {e}")
                    return None
            else:
                # Fallback to basic eval (less safe, but works)
                # Add math functions to context
                safe_context = {
                    '__builtins__': {},
                    'abs': abs, 'min': min, 'max': max,
                    'round': round, 'pow': pow,
                    'sqrt': math.sqrt, 'sin': math.sin, 'cos': math.cos,
                    'tan': math.tan, 'log': math.log, 'exp': math.exp,
                    'pi': math.pi, 'e': math.e,
                    **context
                }
                result = eval(formula, safe_context, {})
                return float(result)
                
        except Exception as e:
            logger.error(f"Error evaluating formula for {tag_name}: {e}")
            logger.debug(f"  Formula: {formula}")
            logger.debug(f"  Context: {context}")
            return None
    
    def evaluate_all(self):
        """
        Evaluate all calculation tags in dependency order
        """
        if not self.calculation_tags:
            return
        
        for tag_name in self.evaluation_order:
            tag_info = self.calculation_tags[tag_name]
            
            # Evaluate formula
            result = self._evaluate_formula(
                tag_name,
                tag_info['formula'],
                tag_info['variables']
            )
            
            if result is not None:
                # Update if value changed
                if result != tag_info['last_value']:
                    tag_info['last_value'] = result
                    tag_info['last_update'] = time.time()
                    tag_info['status'] = 'good'
                    tag_info['error'] = None
                    
                    # Write to DATA_STORE (this will trigger protocol server updates)
                    DATA_STORE.write(tag_name, result)
                    
                    logger.debug(f"Updated {tag_name} = {result}")
            else:
                # Evaluation failed
                tag_info['status'] = 'error'
                tag_info['error'] = 'Evaluation failed'
    
    def start(self, update_interval: float = 1.0):
        """
        Start the calculation engine in a background thread
        
        Args:
            update_interval: How often to evaluate (in seconds)
        """
        if self.running:
            logger.warning("Calculation engine already running")
            return
        
        self.update_interval = update_interval
        self.running = True
        self.stop_event.clear()
        
        def calculation_loop():
            logger.info(f"Calculation engine started, updating every {self.update_interval}s")
            logger.info(f"Evaluating {len(self.calculation_tags)} calculation tags")
            
            while not self.stop_event.is_set():
                try:
                    self.evaluate_all()
                except Exception as e:
                    logger.error(f"Error in calculation loop: {e}", exc_info=True)
                
                # Wait for next cycle
                self.stop_event.wait(self.update_interval)
            
            logger.info("Calculation engine stopped")
        
        self.thread = threading.Thread(target=calculation_loop, daemon=True, name="CalculationEngine")
        self.thread.start()
        
        logger.info(f"Started calculation engine for {len(self.calculation_tags)} tags")
    
    def stop(self):
        """Stop the calculation engine"""
        if not self.running:
            return
        
        logger.info("Stopping calculation engine...")
        self.running = False
        self.stop_event.set()
        
        if self.thread:
            self.thread.join(timeout=5.0)
            self.thread = None
        
        logger.info("Calculation engine stopped")
    
    def get_status(self) -> Dict[str, Any]:
        """Get status of all calculation tags"""
        return {
            'running': self.running,
            'tag_count': len(self.calculation_tags),
            'update_interval': self.update_interval,
            'evaluation_order': self.evaluation_order,
            'tags': {
                name: {
                    'value': info['last_value'],
                    'status': info['status'],
                    'error': info['error'],
                    'last_update': info['last_update'],
                    'formula': info['formula'],
                    'variables': info['variables']
                }
                for name, info in self.calculation_tags.items()
            }
        }


# Global calculation engine instance
CALCULATION_ENGINE = CalculationEngine()
